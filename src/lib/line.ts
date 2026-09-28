const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

export type LineSendResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "http_error" | "network_error"; status?: number };

async function pushOnce(lineUserId: string, text: string): Promise<LineSendResult> {
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text: text.slice(0, 5000) }],
      }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, reason: "http_error", status: res.status };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

// Retries once on a transient failure (5xx, 429, or a network-level error
// like a timeout) after a short delay. A 4xx other than 429 - e.g. the
// recipient blocked the Official Account, or the LINE user ID is invalid -
// is not retried since trying again can't change that outcome.
function isTransient(result: LineSendResult): boolean {
  if (result.ok) return false;
  if (result.reason === "network_error") return true;
  return result.status === 429 || (result.status !== undefined && result.status >= 500);
}

// Requires a LINE Official Account's Messaging API channel access token.
// Silently no-ops when not configured, same as email/push do without their
// own credentials, so this is safe to call before LINE setup is complete.
export async function sendLineMessage(lineUserId: string, text: string): Promise<LineSendResult> {
  if (!channelAccessToken) return { ok: false, reason: "not_configured" };

  let result = await pushOnce(lineUserId, text);
  if (isTransient(result)) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    result = await pushOnce(lineUserId, text);
  }
  // Never log the LINE user ID itself (a persistent per-recipient
  // identifier) - only the outcome, which is enough to see success/failure
  // rates in Vercel logs without exposing who specifically failed.
  if (!result.ok) {
    console.error("LINE push failed", result.reason, "status" in result ? result.status : undefined);
  }
  return result;
}

export async function sendLineMessages(
  lineUserIds: string[],
  text: string
): Promise<LineSendResult[]> {
  if (!channelAccessToken || lineUserIds.length === 0) return [];

  // Sent one at a time with a short gap, not all at once: firing every
  // recipient's push in parallel (the old Promise.allSettled(...map...))
  // blew straight through LINE's push-API rate limit whenever a
  // notification had more than a handful of LINE-linked recipients - every
  // request landed in the same instant, got 429'd together, and even the
  // single retry above collided again since it fired right back in an
  // equally synchronized burst. Real production logs showed this: 175
  // "LINE push failed http_error 429" over 9 users across
  // schedule/message/reminder notifications.
  const results: LineSendResult[] = [];
  for (let i = 0; i < lineUserIds.length; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 200));
    results.push(await sendLineMessage(lineUserIds[i], text));
  }
  return results;
}
