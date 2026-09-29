import { Resend } from "resend";
import { getGmailClient } from "@/lib/google-calendar";

// "gmail": send through the club's own Gmail via the Google OAuth
// connection already used for calendar sync (free, ~500 recipients/day, no
// domain needed). Anything else: Resend, which only delivers to the
// account owner until a domain is verified there.
const PROVIDER = process.env.EMAIL_PROVIDER === "gmail" ? "gmail" : "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "EFK members <onboarding@resend.dev>";

const RESEND_BATCH_SIZE = 100;
const GMAIL_CONCURRENCY = 2;

// User-supplied text (event titles, message bodies, ...) must be escaped
// before going into an HTML email body - it's free text, not markup.
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailFailureReason =
  | "not_configured"
  | "daily_limit" // provider's daily sending allowance used up
  | "sender_not_verified" // Resend testing mode: no verified domain
  | "rate_limited"
  | "rejected"
  | "network_error"
  | "skipped_limit"; // not attempted: an earlier send hit daily_limit

export type EmailSummary = {
  provider: "gmail" | "resend";
  target: number;
  sent: number;
  failures: Partial<Record<EmailFailureReason, number>>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyResendError(error: { statusCode?: number | null; name?: string; message?: string }) {
  const status = error.statusCode ?? 0;
  if (status === 403 && /testing emails|verify a domain/i.test(error.message ?? "")) {
    return "sender_not_verified" as const;
  }
  if (status === 429 && /quota|daily/i.test(`${error.name} ${error.message}`)) return "daily_limit" as const;
  if (status === 429) return "rate_limited" as const;
  return "rejected" as const;
}

async function sendViaResend(
  to: string[],
  subject: string,
  html: string,
  failures: EmailSummary["failures"]
): Promise<number> {
  if (!resend) {
    failures.not_configured = to.length;
    return 0;
  }
  let sent = 0;
  // One batch request per 100 recipients instead of one request each:
  // firing ~90 requests at once blew through Resend's per-second rate limit.
  for (let i = 0; i < to.length; i += RESEND_BATCH_SIZE) {
    const chunk = to.slice(i, i + RESEND_BATCH_SIZE);
    const payload = chunk.map((address) => ({ from: FROM, to: address, subject, html }));
    let reason: EmailFailureReason | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { error } = await resend.batch.send(payload);
        reason = error ? classifyResendError(error) : null;
        if (error) console.error("email notification failed:", error);
      } catch (e) {
        reason = "network_error";
        console.error("email notification failed:", e);
      }
      if (reason !== "rate_limited" && reason !== "network_error") break;
      await sleep(1000);
    }
    if (reason) failures[reason] = (failures[reason] ?? 0) + chunk.length;
    else sent += chunk.length;
  }
  return sent;
}

function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

// RFC 2822 message for the Gmail API's `raw` field. No From header: Gmail
// fills in the authenticated club account itself.
export function buildGmailRaw(to: string, subject: string, html: string): string {
  const body = Buffer.from(html, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  const message = [
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

function classifyGmailError(e: unknown): EmailFailureReason {
  const err = e as { code?: number | string; status?: number; message?: string };
  const status = Number(err.status ?? err.code) || 0;
  const message = err.message ?? "";
  if (/daily.*limit|sending limit/i.test(message)) return "daily_limit";
  if (status === 429 || /rate limit/i.test(message)) return "rate_limited";
  if (status >= 400 && status < 500) return "rejected";
  return "network_error";
}

async function sendViaGmail(
  to: string[],
  subject: string,
  html: string,
  failures: EmailSummary["failures"]
): Promise<number> {
  let gmail: ReturnType<typeof getGmailClient>;
  try {
    gmail = getGmailClient();
  } catch {
    failures.not_configured = to.length;
    return 0;
  }
  // One message per recipient (a Bcc blast looks like bulk mail to spam
  // filters), two at a time to stay inside Gmail's per-second API quota.
  let sent = 0;
  let limitReached = false;
  let next = 0;
  async function worker() {
    while (next < to.length) {
      const address = to[next++];
      if (limitReached) {
        failures.skipped_limit = (failures.skipped_limit ?? 0) + 1;
        continue;
      }
      let reason: EmailFailureReason | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw: buildGmailRaw(address, subject, html) },
          });
          reason = null;
        } catch (e) {
          reason = classifyGmailError(e);
          // Only the classified reason and Gmail's own message - never the address.
          console.error("email notification failed: gmail", reason, (e as Error).message);
        }
        if (reason !== "rate_limited" && reason !== "network_error") break;
        await sleep(2000);
      }
      if (reason === "daily_limit") limitReached = true;
      if (reason) failures[reason] = (failures[reason] ?? 0) + 1;
      else sent++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(GMAIL_CONCURRENCY, to.length) }, worker));
  return sent;
}

// Best-effort: failures are logged and summarized, never thrown, so they
// can't break the action that triggered the notification.
export async function sendNotificationEmails(
  recipients: { email: string }[],
  subject: string,
  html: string
): Promise<EmailSummary> {
  return sendEmailsVia(PROVIDER, recipients, subject, html);
}

// Same as above with an explicit provider - lets the admin test email go
// through Gmail before EMAIL_PROVIDER switches every notification over.
export async function sendEmailsVia(
  provider: "gmail" | "resend",
  recipients: { email: string }[],
  subject: string,
  html: string
): Promise<EmailSummary> {
  // Same address twice (shouldn't happen - emails are unique per account)
  // still only gets one copy.
  const to = [...new Set(recipients.map((r) => r.email.trim()).filter((e) => e.length > 0))];
  const summary: EmailSummary = { provider, target: to.length, sent: 0, failures: {} };
  if (to.length === 0) return summary;

  summary.sent =
    provider === "gmail"
      ? await sendViaGmail(to, subject, html, summary.failures)
      : await sendViaResend(to, subject, html, summary.failures);
  return summary;
}
