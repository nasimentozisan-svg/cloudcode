import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// line.ts reads process.env.LINE_CHANNEL_ACCESS_TOKEN into a module-scope
// const at import time, so each test that varies it needs a fresh module
// instance - vi.resetModules() + a dynamic re-import.
async function importLineModule() {
  vi.resetModules();
  return import("./line");
}

describe("sendLineMessage / sendLineMessages", () => {
  beforeEach(() => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
  });

  afterEach(() => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = ORIGINAL_TOKEN;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends successfully to every recipient", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendLineMessages } = await importLineModule();

    const results = await sendLineMessages(["u1", "u2", "u3"], "hello");

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports one recipient's failure without affecting the others", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { to: string };
      if (body.to === "blocked-user") {
        return Promise.resolve(new Response("blocked", { status: 400 }));
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { sendLineMessages } = await importLineModule();

    const results = await sendLineMessages(["u1", "blocked-user", "u2"], "hello");

    expect(results[0]).toEqual({ ok: true });
    expect(results[1]).toEqual({ ok: false, reason: "http_error", status: 400, detail: "" });
    expect(results[2]).toEqual({ ok: true });
  });

  it("retries once on a transient 500 and succeeds on the retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("server error", { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendLineMessage } = await importLineModule();

    const result = await sendLineMessage("u1", "hello");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-transient 4xx (e.g. a blocked recipient)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendLineMessage } = await importLineModule();

    const result = await sendLineMessage("u1", "hello");

    expect(result).toEqual({ ok: false, reason: "http_error", status: 400, detail: "" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on a network-level failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendLineMessage } = await importLineModule();

    const result = await sendLineMessage("u1", "hello");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no-ops without calling the API when LINE is not configured", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { sendLineMessage, sendLineMessages } = await importLineModule();

    const single = await sendLineMessage("u1", "hello");
    const many = await sendLineMessages(["u1", "u2"], "hello");

    expect(single).toEqual({ ok: false, reason: "not_configured" });
    expect(many).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps at most 5 push requests in flight at once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight--;
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { sendLineMessages } = await importLineModule();

    const results = await sendLineMessages(Array.from({ length: 12 }, (_, i) => `u${i}`), "hello");

    expect(maxInFlight).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(12);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  // LINE answers 429 both for burst rate limiting and for an exhausted
  // monthly message allowance; only the body tells them apart. Production
  // kept logging 429s after sends were fully serialized, which only the
  // monthly-limit case explains.
  it("stops sending the rest of a batch once the monthly limit is reached, without retrying", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      Response.json({ message: "You have reached your monthly limit." }, { status: 429 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { sendLineMessages } = await importLineModule();

    const results = await sendLineMessages(Array.from({ length: 40 }, (_, i) => `u${i}`), "hello");

    // Only the first wave of concurrent workers reaches LINE; nothing is retried.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(5);
    expect(results.filter((r) => !r.ok && r.reason === "quota_exceeded").length).toBe(
      fetchMock.mock.calls.length
    );
    expect(results.filter((r) => !r.ok && r.reason === "skipped_quota").length).toBe(
      40 - fetchMock.mock.calls.length
    );
  });

  it("retries a burst rate-limit 429 once with the same retry key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ message: "The API rate limit has been exceeded. Try again later." }, { status: 429 })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendLineMessage } = await importLineModule();

    const result = await sendLineMessage("u1", "hello");

    expect(result).toEqual({ ok: true });
    const keys = fetchMock.mock.calls.map(
      ([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers["X-Line-Retry-Key"]
    );
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });

  it("treats 409 on a retry as already delivered (no duplicate)", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(new Response(null, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendLineMessage } = await importLineModule();

    expect(await sendLineMessage("u1", "hello")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
