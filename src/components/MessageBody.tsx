import { MENTION_ALL, type MentionableMember } from "@/lib/mentions";

const BOLD_PATTERN = /(\*\*[^*\n]+\*\*)/g;

// Splits on every "@全員" or "@<member name>" occurrence and highlights it,
// mirroring the notification targeting in postMessageAction so the
// highlighted text is exactly what triggers an email. Also renders
// **bold** markers inserted by the composer's bold button.
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

  const segments = body.split(BOLD_PATTERN);

  return (
    <p className="whitespace-pre-wrap text-sm text-gray-800">
      {segments.map((segment, i) => {
        const isBold = segment.startsWith("**") && segment.endsWith("**") && segment.length > 4;
        const text = isBold ? segment.slice(2, -2) : segment;
        const rendered = renderMentions(text, tokens, `${i}-`);
        return isBold ? <strong key={i}>{rendered}</strong> : <span key={i}>{rendered}</span>;
      })}
    </p>
  );
}

function renderMentions(text: string, tokens: string[], keyPrefix: string) {
  if (tokens.length === 0) return text;

  const pattern = new RegExp(`(@(?:${tokens.map(escapeRegExp).join("|")}))`, "g");
  const parts = text.split(pattern);

  return parts.map((part, i) =>
    part.startsWith("@") && tokens.includes(part.slice(1)) ? (
      <span key={keyPrefix + i} className="rounded bg-emerald-100 px-1 font-medium text-emerald-800">
        {part}
      </span>
    ) : (
      part
    )
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
