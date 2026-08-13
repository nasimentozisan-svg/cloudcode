import { MENTION_ALL, type MentionableMember } from "@/lib/mentions";

// Splits on every "@全員" or "@<member name>" occurrence and highlights it,
// mirroring the notification targeting in postMessageAction so the
// highlighted text is exactly what triggers an email.
export default function MessageBody({
  body,
  members,
}: {
  body: string;
  members: MentionableMember[];
}) {
  const tokens = [MENTION_ALL, ...members.map((m) => m.name)]
    .filter((name) => name.length > 0)
    .sort((a, b) => b.length - a.length);

  if (tokens.length === 0) {
    return <p className="whitespace-pre-wrap text-sm text-gray-800">{body}</p>;
  }

  const pattern = new RegExp(`(@(?:${tokens.map(escapeRegExp).join("|")}))`, "g");
  const parts = body.split(pattern);

  return (
    <p className="whitespace-pre-wrap text-sm text-gray-800">
      {parts.map((part, i) =>
        part.startsWith("@") && tokens.includes(part.slice(1)) ? (
          <span key={i} className="rounded bg-emerald-100 px-1 font-medium text-emerald-800">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
