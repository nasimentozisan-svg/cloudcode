// Minimal iCalendar (RFC 5545) generator - just enough to produce a valid
// VEVENT feed for read-only calendar subscription (Google Calendar, Apple
// Calendar, Outlook can all subscribe to an .ics URL directly).

function foldLine(line: string): string {
  // RFC 5545 requires folding lines longer than 75 octets; without it some
  // stricter parsers reject the feed.
  if (line.length <= 75) return line;
  let result = line.slice(0, 75);
  let rest = line.slice(75);
  while (rest.length > 0) {
    result += "\r\n " + rest.slice(0, 74);
    rest = rest.slice(74);
  }
  return result;
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export type IcsEvent = {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  startAt: Date;
  durationMinutes?: number;
};

export function buildIcsCalendar(calendarName: string, events: IcsEvent[]): string {
  const now = toIcsDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EFK members//JP",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const ev of events) {
    const end = new Date(ev.startAt.getTime() + (ev.durationMinutes ?? 120) * 60 * 1000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.id}@efk-members`,
      `DTSTAMP:${now}`,
      `DTSTART:${toIcsDate(ev.startAt)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:${escapeText(ev.title)}`
    );
    if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`);
    if (ev.notes) lines.push(`DESCRIPTION:${escapeText(ev.notes)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
