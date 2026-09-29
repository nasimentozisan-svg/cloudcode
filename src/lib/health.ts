// One-line, machine-greppable markers for the scheduled health check.
// Everything that should count as "something is wrong for users" goes
// through reportHealth(), which logs at error level so it shows up in
// Vercel's grouped runtime errors under a stable "[health] <kind>" prefix -
// the health check reads that grouped view instead of raw logs.
//
// Never pass personal data (email addresses, LINE user IDs, names, tokens)
// in fields: only counts, route names, status codes and error codes.

export type HealthKind =
  | "push_failed"
  | "email_failed"
  | "calendar_sync_failed"
  | "google_auth_error"
  | "auth_error"
  | "slow";

export type HealthFields = Record<string, string | number | boolean | null | undefined>;

// Keeps values to one token each so a single field can't smuggle in a
// whole error message (which could quote user input) or break the format.
function formatValue(value: string | number | boolean): string {
  return String(value).replace(/[^\w.:/\-]+/g, "_").slice(0, 80);
}

function formatLine(prefix: string, fields: HealthFields): string {
  const parts = Object.entries(fields)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] != null && entry[1] !== "")
    .map(([key, value]) => `${key}=${formatValue(value)}`);
  return [prefix, ...parts].join(" ");
}

export function formatHealthLine(kind: HealthKind, fields: HealthFields = {}): string {
  return formatLine(`[health] ${kind}`, fields);
}

export function reportHealth(kind: HealthKind, fields: HealthFields = {}): void {
  console.error(formatHealthLine(kind, fields));
}

// Normal-level counterpart for "this ran and was fine" - not an error, so
// it never shows up in the grouped error view.
export function reportHealthOk(kind: string, fields: HealthFields = {}): void {
  console.log(formatLine(`[health-ok] ${kind}`, fields));
}

// A short, non-personal description of an error: HTTP status and the
// provider's error code (e.g. Google's "invalid_grant", jose's
// "ERR_JWT_EXPIRED", Prisma's "P1001") - never the free-text message.
export function errorCode(error: unknown): string {
  const e = error as {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    name?: unknown;
    response?: { status?: unknown; data?: { error?: unknown } };
  } | null;
  if (!e || typeof e !== "object") return "unknown";
  const status = e.response?.status ?? e.status ?? e.statusCode ?? (typeof e.code === "number" ? e.code : undefined);
  const googleError = e.response?.data?.error;
  const code =
    (typeof googleError === "string" ? googleError : undefined) ??
    (typeof e.code === "string" ? e.code : undefined) ??
    (typeof e.name === "string" ? e.name : undefined);
  return [status, code].filter((v) => v != null && v !== "").join("_") || "unknown";
}

// Google answers a revoked/expired refresh token with invalid_grant (and
// a bad client with invalid_client / 401) - those mean the OAuth connection itself is
// broken, not just one API call.
export function isGoogleAuthFailure(error: unknown): boolean {
  const code = errorCode(error);
  return /invalid_grant|unauthorized_client|invalid_client|^401/i.test(code);
}
