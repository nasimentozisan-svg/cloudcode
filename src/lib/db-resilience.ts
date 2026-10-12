import pg, { type PoolClient, type PoolConfig } from "pg";
import { reportHealth } from "@/lib/health";

// Production showed a request's first DB query occasionally stalling for
// 30-100s (and a few never returning until Vercel killed the function at
// 300s), while the same queries normally take ~10ms on a reused connection
// and ~300ms on a new one. node-postgres waits forever by default - no
// limit on opening a connection, none on a query whose socket silently died
// - so any stall became the user's wait. These limits turn a stall into a
// fast error, which withRetry (below) recovers from on a fresh connection.
export const POOL_OPTIONS: PoolConfig = {
  // DATABASE_URL already points at Prisma Postgres's own pooled endpoint, so
  // a small per-instance pool is enough (see src/lib/prisma.ts).
  max: 3,
  // pg's default, spelled out: attachDatabasePool keeps the instance alive
  // this long after the last query so idle connections are closed cleanly.
  idleTimeoutMillis: 10_000,
  // Opening a connection (TCP + TLS + auth) normally takes ~0.3s in
  // production; ten times that means this attempt is stuck - retry instead.
  connectionTimeoutMillis: 3_000,
  // Every query this app runs finishes in well under a second (production:
  // ~10ms reused, ~0.3s on a new connection); anything still waiting after
  // this is a stalled connection, not a slow query. 4s (was 8s) cut waits
  // over 5s by ~90% in the stall simulation with no extra load when healthy.
  query_timeout: 4_000,
  // Lets the OS notice a connection that died while the instance was running.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
};

// Prisma operations that only read: safe to run again if the first attempt
// failed at the connection level (nothing could have been written).
export const RETRYABLE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const CONNECTION_ERROR =
  /Connection terminated|connection timeout|timeout exceeded when trying to connect|Query read timeout|ECONNRESET|ETIMEDOUT|EPIPE|server conn crashed|Failed to connect to upstream database|Can't reach database server|P1001|P1017|DatabaseNotReachable|ConnectionClosed|SocketTimeout/i;

// Walks the error and its causes (Prisma wraps the driver error), matching
// only connection-level failures - never a constraint or validation error.
export function isConnectionError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const e = current as { message?: unknown; code?: unknown; kind?: unknown; cause?: unknown };
    const text = [e.message, e.code, e.kind].filter((v) => typeof v === "string").join(" ");
    if (CONNECTION_ERROR.test(text)) return true;
    current = e.cause;
  }
  return false;
}

const MAX_READ_ATTEMPTS = 4;
// Pause before the 2nd/3rd/4th attempt. The first retry is immediate (most
// stalls affect one connection, a fresh one usually answers at once); later
// ones back off a little so a database that is down isn't hammered.
const RETRY_DELAYS_MS = [0, 200, 400];
// No new attempt starts after this much time has passed, which bounds the
// wait during a longer outage (~16s, or ~23s if the last attempt also runs
// into its own connect + query limits).
const RETRY_DEADLINE_MS = 16_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs a read again (up to 4 attempts, within RETRY_DEADLINE_MS) after a
// connection-level failure. Each retry gets a new connection: pg drops a
// client that errored instead of reusing it. Writes are never retried - a
// dropped connection may have already committed them.
export async function withRetry<T>(operation: string, run: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const retryable = RETRYABLE_OPERATIONS.has(operation) && isConnectionError(error);
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 0;
      const outOfTime = Date.now() - startedAt + delay >= RETRY_DEADLINE_MS;
      if (!retryable || attempt >= MAX_READ_ATTEMPTS || outOfTime) {
        if (isConnectionError(error)) {
          reportHealth("db_error", { op: operation, attempts: attempt, retried: RETRYABLE_OPERATIONS.has(operation) });
        }
        throw error;
      }
      reportHealth("db_retry", { op: operation, attempt });
      if (delay > 0) await sleep(delay);
    }
  }
}

// A connection that has sat idle longer than this may belong to a socket
// the network already forgot. pg normally closes idle connections at 10s,
// but when Vercel freezes the instance before that timer runs, the next
// request after a thaw can pick the dead connection up before the overdue
// timer fires - and a query on it never returns.
const STALE_AFTER_MS = 9_000;
const SLOW_CONNECT_MS = 1_000;

// pg.Pool that never hands out a connection idle past STALE_AFTER_MS
// (wall clock, so time spent frozen counts). It discards it and opens a
// fresh one instead - ~0.3s, versus waiting out query_timeout.
export class FreshPool extends pg.Pool {
  private lastReleased = new WeakMap<PoolClient, number>();

  constructor(config: PoolConfig) {
    super(config);
    this.on("release", (_err: Error | undefined, client: PoolClient) => this.lastReleased.set(client, Date.now()));
  }

  // pg-pool's own query() calls connect() with a callback; callers outside
  // it (transactions) use the promise form. Support both.
  connect(): Promise<PoolClient>;
  connect(callback: (err: Error | undefined, client: PoolClient | undefined, done: (release?: unknown) => void) => void): void;
  connect(callback?: (err: Error | undefined, client: PoolClient | undefined, done: (release?: unknown) => void) => void) {
    const fresh = this.connectFresh();
    if (!callback) return fresh;
    fresh.then(
      (client) => callback(undefined, client, (release?: unknown) => client.release(release as boolean | Error | undefined)),
      (err: Error) => callback(err, undefined, () => {})
    );
  }

  private async connectFresh(): Promise<PoolClient> {
    for (;;) {
      const startedAt = Date.now();
      const waiting = this.waitingCount;
      const client = await super.connect();
      const released = this.lastReleased.get(client);
      if (released === undefined) {
        // A brand-new connection. Normally ~0.3s; record the slow ones so
        // production shows whether stalls happen while opening connections
        // (and whether requests were queued behind a full pool).
        const ms = Date.now() - startedAt;
        if (ms > SLOW_CONNECT_MS) {
          reportHealth("db_slow_connect", { ms, pool_total: this.totalCount, queued_before: waiting });
        }
        return client;
      }
      if (Date.now() - released <= STALE_AFTER_MS) return client;
      this.lastReleased.delete(client);
      client.release(true); // destroy, don't return it to the pool
    }
  }
}
