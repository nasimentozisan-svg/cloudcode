import { MENTION_ALL, type MentionableMember } from "@/lib/mentions";

const BOLD_PATTERN = /(\*\*[^*\n]+\*\*)/g;
// Deliberately a whitelist of known-safe URL characters (RFC 3986 unreserved
// + common reserved chars), not a blacklist of whitespace - a Japanese
// sentence glued directly onto a URL with no space (e.g. "https://x.com/pを見て。")
// or a URL wrapped in parens/quotes needs the boundary to stop at the URL
// itself, not swallow everything non-whitespace after it.
const URL_PATTERN = /(https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'*+,;=%]+)/g;
// Trailing characters that are almost always sentence punctuation rather
// than part of the URL (e.g. a stray "." the whitelist above still allowed
// mid-match, picked up because it's also a valid domain/path character).
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;

// Splits on every "@全員" or "@<member name>" occurrence and highlights it,
// mirroring the notification targeting in postMessageAction so the
// highlighted text is exactly what triggers an email. Also renders
// **bold** markers inserted by the composer's bold button, and turns
// http(s):// links into tappable <a> tags - opening in a new tab lets the
// OS hand off to the matching app (e.g. YouTube) instead of the PWA trying
// to navigate to it itself.
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
    <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
      {segments.map((segment, i) => {
        const isBold = segment.startsWith("**") && segment.endsWith("**") && segment.length > 4;
        const text = isBold ? segment.slice(2, -2) : segment;
        const rendered = renderLinks(text, tokens, `${i}-`);
        return isBold ? <strong key={i}>{rendered}</strong> : <span key={i}>{rendered}</span>;
      })}
    </p>
  );
}

function renderLinks(text: string, tokens: string[], keyPrefix: string) {
  // URL_PATTERN has exactly one capture group, so String.split alternates
  // plain text (even indices) with matched URLs (odd indices).
  const parts = text.split(URL_PATTERN);
  return parts.flatMap((part, i) => {
    if (i % 2 === 0) {
      return renderMentions(part, tokens, `${keyPrefix}${i}-`);
    }
    const trailingMatch = part.match(TRAILING_PUNCTUATION);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    const url = trailing ? part.slice(0, part.length - trailing.length) : part;
    return [
      <a
        key={`${keyPrefix}${i}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-700 underline"
      >
        {url}
      </a>,
      trailing,
    ];
  });
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
