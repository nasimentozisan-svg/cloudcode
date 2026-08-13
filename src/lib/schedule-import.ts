// Parses a fixed, simple text format so schedule events can be bulk-created
// without any paid parsing service. The intended workflow: paste a messy
// match schedule (image/PDF) into a chat with Claude, ask it to reformat
// into this format, then paste the result here.
//
// One event per line: `YYYY-MM-DD HH:MM,タイトル,場所` (場所は省略可)
export type ParsedScheduleLine = {
  lineNumber: number;
  raw: string;
  title: string;
  startAt: Date;
  location: string | null;
  error: null;
} | {
  lineNumber: number;
  raw: string;
  title: null;
  startAt: null;
  location: null;
  error: string;
};

const LINE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*,\s*([^,]+)\s*(?:,\s*(.*))?$/;

export function parseScheduleText(text: string): ParsedScheduleLine[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.map((raw, i) => {
    const lineNumber = i + 1;
    const match = raw.match(LINE_PATTERN);
    if (!match) {
      return {
        lineNumber,
        raw,
        title: null,
        startAt: null,
        location: null,
        error: "形式が正しくありません（例: 2026-08-20 15:00,対〇〇FC,市営体育館）",
      };
    }

    const [, year, month, day, hour, minute, titleRaw, locationRaw] = match;
    const startAt = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );
    if (Number.isNaN(startAt.getTime())) {
      return {
        lineNumber,
        raw,
        title: null,
        startAt: null,
        location: null,
        error: "日付・時刻が正しくありません",
      };
    }

    const title = titleRaw.trim();
    if (title.length === 0) {
      return {
        lineNumber,
        raw,
        title: null,
        startAt: null,
        location: null,
        error: "タイトルが空です",
      };
    }

    return {
      lineNumber,
      raw,
      title,
      startAt,
      location: locationRaw?.trim() || null,
      error: null,
    };
  });
}
