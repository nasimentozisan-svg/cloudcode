import { randomUUID } from "node:crypto";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// Parallel pushes in flight at once. LINE's push rate limit is far above
// this (2,000 req/s); the limit just keeps one big notification from
// opening dozens of sockets at the same moment.
const SEND_CONCURRENCY = 5;

export type LineFailureReason =
  | "not_configured"
  // The Official Account's monthly message allowance is used up - LINE
  // answers 429 with "You have reached your monthly limit." No retry or
  // later recipient in the same batch can succeed until the plan resets or
  // is upgraded.
  | "quota_exceeded"
  | "rate_limited"
  | "http_error"
  | "network_error"
  // Not attempted because an earlier recipient already hit quota_exceeded.
  | "skipped_quota";

export type LineSendResult =
  | { ok: true }
  | { ok: false; reason: LineFailureReason; status?: number; detail?: string };

async function pushOnce(lineUserId: string, text: string, retryKey: string): Promise<LineSendResult> {
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
        // Makes a retry idempotent: if the first attempt was actually
        // accepted (e.g. the response was lost to a timeout), LINE answers
        // the retry with 409 instead of delivering a duplicate.
        "X-Line-Retry-Key": retryKey,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text: text.slice(0, 5000) }],
      }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 409) return { ok: true };

    // LINE's error bodies are {"message": "...", "details": [...]} and never
    // echo the recipient, so the message is safe to log.
    let detail = "";
    try {
      detail = String(((await res.json()) as { message?: unknown }).message ?? "");
    } catch {}
    if (res.status === 429) {
      return /monthly limit/i.test(detail)
        ? { ok: false, reason: "quota_exceeded", status: 429, detail }
        : { ok: false, reason: "rate_limited", status: 429, detail };
    }
    return { ok: false, reason: "http_error", status: res.status, detail };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

// Retried once: rate limiting, 5xx, network errors. Not retried: other 4xx
// (e.g. an invalid user ID) and quota_exceeded, since trying again can't
// change those outcomes.
function isTransient(result: LineSendResult): boolean {
  if (result.ok) return false;
  if (result.reason === "network_error" || result.reason === "rate_limited") return true;
  return result.reason === "http_error" && result.status !== undefined && result.status >= 500;
}

// Requires a LINE Official Account's Messaging API channel access token.
// Silently no-ops when not configured, same as email/push do without their
// own credentials, so this is safe to call before LINE setup is complete.
export async function sendLineMessage(lineUserId: string, text: string): Promise<LineSendResult> {
  if (!channelAccessToken) return { ok: false, reason: "not_configured" };

  const retryKey = randomUUID();
  let result = await pushOnce(lineUserId, text, retryKey);
  if (isTransient(result)) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = await pushOnce(lineUserId, text, retryKey);
  }
  // Never log the LINE user ID itself (a persistent per-recipient
  // identifier) - only the outcome and LINE's own error message.
  if (!result.ok) {
    console.error("LINE push failed", result.reason, result.status, result.detail ?? "");
  }
  return result;
}

export async function sendLineMessages(
  lineUserIds: string[],
  text: string
): Promise<LineSendResult[]> {
  if (!channelAccessToken || lineUserIds.length === 0) return [];

  const results: LineSendResult[] = new Array(lineUserIds.length);
  let quotaExceeded = false;
  let next = 0;
  async function worker() {
    while (next < lineUserIds.length) {
      const i = next++;
      if (quotaExceeded) {
        results[i] = { ok: false, reason: "skipped_quota" };
        continue;
      }
      const result = await sendLineMessage(lineUserIds[i], text);
      results[i] = result;
      if (!result.ok && result.reason === "quota_exceeded") quotaExceeded = true;
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(SEND_CONCURRENCY, lineUserIds.length) }, worker)
  );
  return results;
}
