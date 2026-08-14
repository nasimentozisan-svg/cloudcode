// Server Components/Actions run on Vercel with the system default timezone
// (UTC), not the club's actual timezone, so any date formatting/parsing done
// there must explicitly pin Asia/Tokyo or it silently shows/stores times
// ~9 hours off from what members typed or expect to see. Client Components
// don't need this - the browser's own local timezone (JST, for this club)
// is already correct there.
export const JST_TIMEZONE = "Asia/Tokyo";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function formatJST(date: Date, options: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString("ja-JP", { ...options, timeZone: JST_TIMEZONE });
}

export function getJSTDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JST_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

// Parses a `<input type="datetime-local">` value (e.g. "2026-09-05T21:00",
// no timezone info) as JST wall-clock time, regardless of the server's own
// local timezone.
export function parseJSTDatetimeLocal(value: string): Date | null {
  const match = value.match(DATETIME_LOCAL_PATTERN);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const utcMillis =
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) -
    JST_OFFSET_MS;
  const date = new Date(utcMillis);
  return Number.isNaN(date.getTime()) ? null : date;
}

// The inverse of parseJSTDatetimeLocal: formats a Date back into a
// "YYYY-MM-DDTHH:mm" JST wall-clock string, for pre-filling a datetime-local
// input's defaultValue on an edit form.
export function toJSTDatetimeLocalValue(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const mo = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const mi = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}
