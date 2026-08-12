import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "EFK members <onboarding@resend.dev>";

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

// Best-effort: notification email failures must never break the action that
// triggered them (creating an event, posting a message), so every call site
// fires this and moves on rather than awaiting a rejection.
export async function sendNotificationEmails(
  recipients: { email: string }[],
  subject: string,
  html: string
) {
  if (!resend || recipients.length === 0) return;

  const results = await Promise.allSettled(
    recipients.map((r) =>
      resend!.emails.send({ from: FROM, to: r.email, subject, html })
    )
  );
  for (const r of results) {
    // The Resend SDK resolves (doesn't reject) with { error } on API-level
    // failures - only network/thrown errors show up as a rejected promise.
    if (r.status === "rejected") {
      console.error("email notification failed:", r.reason);
    } else if (r.value.error) {
      console.error("email notification failed:", r.value.error);
    }
  }
}
