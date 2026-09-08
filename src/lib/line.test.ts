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
    expect(results[1]).toEqual({ ok: false, reason: "http_error", status: 400 });
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

    expect(result).toEqual({ ok: false, reason: "http_error", status: 400 });
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
});
