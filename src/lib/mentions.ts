// Slack-style @mentions: by default a new message sends no email to anyone.
// Only messages that @mention a specific member (or @全員 for everyone in
// the channel) trigger an email notification, and only to the mentioned
// people — so casual chat stays silent while important messages still reach
// people's inboxes.
export const MENTION_ALL = "全員";

export type MentionableMember = { id: string; name: string };

export function findMentions(
  body: string,
  members: MentionableMember[]
): { userIds: string[]; all: boolean } {
  const all = body.includes(`@${MENTION_ALL}`);
  const sorted = [...members].sort((a, b) => b.name.length - a.name.length);
  const userIds = sorted.filter((m) => body.includes(`@${m.name}`)).map((m) => m.id);
  return { userIds, all };
}

// Finds an in-progress "@query" the caret is currently inside, so the
// composer can show a mention autocomplete dropdown while typing.
export function activeMentionQuery(
  text: string,
  caret: number
): { query: string; start: number } | null {
  const uptoCaret = text.slice(0, caret);
  const at = uptoCaret.lastIndexOf("@");
  if (at === -1) return null;
  const query = uptoCaret.slice(at + 1);
  if (/[\s@]/.test(query)) return null;
  return { query, start: at };
}
