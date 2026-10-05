import { afterEach, describe, expect, it, vi } from "vitest";
import { POOL_OPTIONS, isConnectionError, withRetry } from "./db-resilience";

afterEach(() => vi.restoreAllMocks());

const healthLines = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith("[health]"));

describe("POOL_OPTIONS", () => {
  it("never waits forever: bounded connect and query time, keepalive on", () => {
    expect(POOL_OPTIONS.connectionTimeoutMillis).toBeGreaterThan(0);
    expect(POOL_OPTIONS.query_timeout).toBeGreaterThan(0);
    expect(POOL_OPTIONS.keepAlive).toBe(true);
    expect(POOL_OPTIONS.max).toBe(3);
    // attachDatabasePool only hooks a pool that has idleTimeoutMillis.
    expect(POOL_OPTIONS.idleTimeoutMillis).toBe(10_000);
  });
});

describe("isConnectionError", () => {
  it("recognises the connection failures production logged, including wrapped by Prisma", () => {
    expect(isConnectionError(new Error("Connection terminated unexpectedly"))).toBe(true);
    expect(isConnectionError(new Error("Connection terminated due to connection timeout"))).toBe(true);
    expect(isConnectionError(new Error("Query read timeout"))).toBe(true);
    expect(
      isConnectionError(Object.assign(new Error("Invalid `prisma.user.findUnique()` invocation"), { cause: new Error("server conn crashed?") }))
    ).toBe(true);
    expect(isConnectionError(new Error("Failed to connect to upstream database."))).toBe(true);
  });

  it("does not treat ordinary query errors as connection errors", () => {
    expect(isConnectionError(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }))).toBe(false);
    expect(isConnectionError(new Error("Record to update not found."))).toBe(false);
    expect(isConnectionError(null)).toBe(false);
  });
});

describe("withRetry", () => {
  it("retries a read on a fresh attempt after a connection error and succeeds", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn().mockRejectedValueOnce(new Error("Query read timeout")).mockResolvedValueOnce("user");
    await expect(withRetry("findUnique", run)).resolves.toBe("user");
    expect(run).toHaveBeenCalledTimes(2);
    expect(healthLines(err)).toEqual(["[health] db_retry op=findUnique attempt=1"]);
  });

  it("gives up after 3 attempts and reports it", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn().mockRejectedValue(new Error("Connection terminated due to connection timeout"));
    await expect(withRetry("findMany", run)).rejects.toThrow("connection timeout");
    expect(run).toHaveBeenCalledTimes(3);
    expect(healthLines(err).at(-1)).toBe("[health] db_error op=findMany attempts=3 retried=true");
  });

  it("never retries a write - a dropped connection may already have committed it", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn().mockRejectedValue(new Error("Connection terminated unexpectedly"));
    await expect(withRetry("create", run)).rejects.toThrow();
    expect(run).toHaveBeenCalledTimes(1);
    expect(healthLines(err)).toEqual(["[health] db_error op=create attempts=1 retried=false"]);
  });

  it("does not retry non-connection errors, and stays quiet about them", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn().mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    await expect(withRetry("findUnique", run)).rejects.toThrow();
    expect(run).toHaveBeenCalledTimes(1);
    expect(healthLines(err)).toEqual([]);
  });
});
