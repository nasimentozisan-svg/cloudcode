const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// Requires a LINE Official Account's Messaging API channel access token.
// Silently no-ops when not configured, same as email/push do without their
// own credentials, so this is safe to call before LINE setup is complete.
export async function sendLineMessage(lineUserId: string, text: string): Promise<void> {
  if (!channelAccessToken) return;

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
  if (!res.ok) {
    console.error("LINE push failed", res.status, await res.text().catch(() => ""));
  }
}

export async function sendLineMessages(lineUserIds: string[], text: string): Promise<void> {
  if (!channelAccessToken || lineUserIds.length === 0) return;
  await Promise.allSettled(lineUserIds.map((id) => sendLineMessage(id, text)));
}
