import { afterEach, describe, expect, it, vi } from "vitest";

const batchSendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    batch = { send: (...args: unknown[]) => batchSendMock(...args) };
  },
}));

const gmailSendMock = vi.fn();
vi.mock("@/lib/google-calendar", () => ({
  getGmailClient: () => ({ users: { messages: { send: (...args: unknown[]) => gmailSendMock(...args) } } }),
}));

const ORIGINAL_ENV = { ...process.env };

// email.ts picks the provider at import time, so each test re-imports it.
async function importEmail(env: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };
  return import("./email");
}

const people = (n: number) => Array.from({ length: n }, (_, i) => ({ email: `p${i}@example.com` }));

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  batchSendMock.mockReset();
  gmailSendMock.mockReset();
  vi.restoreAllMocks();
});

describe("sendNotificationEmails via Resend", () => {
  it("sends 250 recipients as 3 batch requests instead of 250 individual ones", async () => {
    batchSendMock.mockResolvedValue({ data: {}, error: null });
    const { sendNotificationEmails } = await importEmail({ RESEND_API_KEY: "k", EMAIL_PROVIDER: undefined });

    const summary = await sendNotificationEmails(people(250), "件名", "<p>本文</p>");

    expect(batchSendMock).toHaveBeenCalledTimes(3);
    expect(batchSendMock.mock.calls.map(([p]) => (p as unknown[]).length)).toEqual([100, 100, 50]);
    expect(summary).toMatchObject({ provider: "resend", target: 250, sent: 250, failures: {} });
  });

  it("classifies the production failure (unverified sender / testing mode) and does not retry it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    batchSendMock.mockResolvedValue({
      data: null,
      error: {
        statusCode: 403,
        name: "validation_error",
        message: "You can only send testing emails to your own email address (owner@example.com). To send emails to other recipients, please verify a domain at resend.com/domains",
      },
    });
    const { sendNotificationEmails } = await importEmail({ RESEND_API_KEY: "k" });

    const summary = await sendNotificationEmails(people(3), "s", "h");

    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(summary.failures).toEqual({ sender_not_verified: 3 });
  });

  it("retries a rate-limited batch once", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    batchSendMock
      .mockResolvedValueOnce({ data: null, error: { statusCode: 429, name: "rate_limit_exceeded", message: "Too many requests" } })
      .mockResolvedValueOnce({ data: {}, error: null });
    const { sendNotificationEmails } = await importEmail({ RESEND_API_KEY: "k" });

    const summary = await sendNotificationEmails(people(2), "s", "h");

    expect(batchSendMock).toHaveBeenCalledTimes(2);
    expect(summary.sent).toBe(2);
  });

  it("gives every batch its own idempotency key and reuses it on the retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // First batch: the SDK reports "no response" (statusCode null) - it may
    // have gone out - then succeeds on the retry. Second batch: fine at once.
    batchSendMock
      .mockResolvedValueOnce({ data: null, error: { statusCode: null, name: "application_error", message: "Unable to fetch data." } })
      .mockResolvedValue({ data: {}, error: null });
    const { sendNotificationEmails } = await importEmail({ RESEND_API_KEY: "k" });

    const summary = await sendNotificationEmails(people(150), "s", "h");

    const keys = batchSendMock.mock.calls.map(([, options]) => (options as { idempotencyKey: string }).idempotencyKey);
    expect(keys).toHaveLength(3);
    expect(keys[0]).toBe(keys[1]); // the retry of batch 1 is the same request to Resend
    expect(keys[2]).not.toBe(keys[0]);
    expect(keys[0]).toMatch(/^efk-notify\/[0-9a-f-]{36}\/0$/);
    expect(keys[2]).toMatch(/\/1$/);
    expect(summary).toMatchObject({ target: 150, sent: 150, failures: {} });
  });

  it("uses a fresh key for each notification, so a later notification is never swallowed", async () => {
    batchSendMock.mockResolvedValue({ data: {}, error: null });
    const { sendNotificationEmails } = await importEmail({ RESEND_API_KEY: "k" });

    await sendNotificationEmails(people(1), "s", "h");
    await sendNotificationEmails(people(1), "s", "h");

    const [first, second] = batchSendMock.mock.calls.map(([, o]) => (o as { idempotencyKey: string }).idempotencyKey);
    expect(first).not.toBe(second);
  });

  it("reports a batch that still has no answer after the retry as unknown_result, not as sent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    batchSendMock.mockResolvedValue({ data: null, error: { statusCode: 503, name: "application_error", message: "Service Unavailable" } });
    const { sendNotificationEmails } = await importEmail({ RESEND_API_KEY: "k" });

    const summary = await sendNotificationEmails(people(4), "s", "h");

    expect(batchSendMock).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({ sent: 0, failures: { unknown_result: 4 } });
  });

  it("does not retry a definite rejection (e.g. invalid address)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    batchSendMock.mockResolvedValue({ data: null, error: { statusCode: 422, name: "validation_error", message: "Invalid `to` field." } });
    const { sendNotificationEmails } = await importEmail({ RESEND_API_KEY: "k" });

    const summary = await sendNotificationEmails(people(2), "s", "h");

    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(summary.failures).toEqual({ rejected: 2 });
  });
});

describe("sendNotificationEmails via Gmail: retry only when nothing was sent", () => {
  async function sendOneWith(error: unknown) {
    vi.useFakeTimers();
    try {
      vi.spyOn(console, "error").mockImplementation(() => {});
      gmailSendMock.mockRejectedValueOnce(error).mockResolvedValue({ data: { id: "x" } });
      const { sendNotificationEmails } = await importEmail({ EMAIL_PROVIDER: "gmail" });
      const pending = sendNotificationEmails(people(1), "s", "h");
      await vi.advanceTimersByTimeAsync(10_000);
      return await pending;
    } finally {
      vi.useRealTimers();
    }
  }

  it.each([
    ["DNS lookup failed", Object.assign(new Error("getaddrinfo ENOTFOUND gmail.googleapis.com"), { code: "ENOTFOUND" })],
    ["connection refused", Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })],
    ["wrapped in a cause", Object.assign(new Error("request failed"), { cause: { code: "EAI_AGAIN" } })],
    [
      "access-token refresh failed",
      Object.assign(new Error("socket hang up"), { code: "ECONNRESET", config: { url: "https://oauth2.googleapis.com/token" } }),
    ],
  ])("retries once when the message certainly was not sent (%s)", async (_label, error) => {
    const summary = await sendOneWith(error);

    expect(gmailSendMock).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({ sent: 1, failures: {} });
  });

  it.each([
    ["timeout", Object.assign(new Error("request to https://gmail.googleapis.com timed out"), { code: "ETIMEDOUT" })],
    ["connection reset mid-request", Object.assign(new Error("socket hang up"), { code: "ECONNRESET" })],
    ["Gmail 500", Object.assign(new Error("Backend Error"), { status: 500, code: 500 })],
    ["Gmail 503 (status as string code)", Object.assign(new Error("Service Unavailable"), { code: "503" })],
    ["unrecognised error", new Error("something odd")],
  ])("does not resend when the result is unknown (%s) - it may already have been delivered", async (_label, error) => {
    const summary = await sendOneWith(error);

    expect(gmailSendMock).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ sent: 0, failures: { unknown_result: 1 } });
  });

  it("does not retry a definite rejection (400 invalid recipient)", async () => {
    const summary = await sendOneWith(Object.assign(new Error("Invalid To header"), { status: 400 }));

    expect(gmailSendMock).toHaveBeenCalledTimes(1);
    expect(summary.failures).toEqual({ rejected: 1 });
  });

  it("retries a network failure at most once", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(console, "error").mockImplementation(() => {});
      gmailSendMock.mockRejectedValue(Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }));
      const { sendNotificationEmails } = await importEmail({ EMAIL_PROVIDER: "gmail" });
      const pending = sendNotificationEmails(people(1), "s", "h");
      await vi.advanceTimersByTimeAsync(10_000);
      const summary = await pending;

      expect(gmailSendMock).toHaveBeenCalledTimes(2);
      expect(summary.failures).toEqual({ network_error: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("sendNotificationEmails via Gmail", () => {
  it("sends one properly encoded message per recipient, never more than 2 at once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    gmailSendMock.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { data: { id: "x" } };
    });
    const { sendNotificationEmails } = await importEmail({ EMAIL_PROVIDER: "gmail" });

    const summary = await sendNotificationEmails(people(7), "【EFK members】新しい予定", "<p>練習 19:00</p>");

    expect(summary).toMatchObject({ provider: "gmail", target: 7, sent: 7, failures: {} });
    expect(gmailSendMock).toHaveBeenCalledTimes(7);
    expect(maxInFlight).toBe(2);
    const raw = (gmailSendMock.mock.calls[0][0] as { userId: string; requestBody: { raw: string } }).requestBody.raw;
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("To: p0@example.com\r\n");
    expect(decoded).toContain(`Subject: =?UTF-8?B?${Buffer.from("【EFK members】新しい予定").toString("base64")}?=`);
    const body = decoded.split("\r\n\r\n")[1].replace(/\r\n/g, "");
    expect(Buffer.from(body, "base64").toString("utf8")).toBe("<p>練習 19:00</p>");
    // Only one recipient per message - nobody sees anyone else's address.
    expect(decoded).not.toMatch(/Bcc|p1@example\.com/);
  });

  it("stops the rest of the batch once Gmail's daily sending limit is hit", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    gmailSendMock.mockRejectedValue(Object.assign(new Error("Daily user sending limit exceeded."), { code: 403 }));
    const { sendNotificationEmails } = await importEmail({ EMAIL_PROVIDER: "gmail" });

    const summary = await sendNotificationEmails(people(20), "s", "h");

    expect(gmailSendMock.mock.calls.length).toBeLessThanOrEqual(2);
    expect(summary.sent).toBe(0);
    expect((summary.failures.daily_limit ?? 0) + (summary.failures.skipped_limit ?? 0)).toBe(20);
  });

  it("waits out Gmail's per-minute quota and still delivers everything (9/30 production failure)", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(console, "error").mockImplementation(() => {});
      // The exact error production got for a @全員 post: 403 + per-minute quota.
      const quotaError = Object.assign(
        new Error(
          "Quota exceeded for quota metric 'Total Query Cost' and limit 'Units per minute per user' of service 'gmail.googleapis.com' for consumer 'project_number:1'."
        ),
        { status: 403 }
      );
      let calls = 0;
      gmailSendMock.mockImplementation(async () => {
        calls++;
        // Calls 3-6 land while the quota is exhausted.
        if (calls >= 3 && calls <= 6) throw quotaError;
        return { data: { id: "x" } };
      });
      const { sendNotificationEmails } = await importEmail({ EMAIL_PROVIDER: "gmail" });

      const pending = sendNotificationEmails(people(10), "s", "h");
      await vi.advanceTimersByTimeAsync(120_000);
      const summary = await pending;

      expect(summary).toMatchObject({ target: 10, sent: 10, failures: {} });
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up on an address after the backoff runs out, reporting it as rate_limited", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(console, "error").mockImplementation(() => {});
      gmailSendMock.mockRejectedValue(Object.assign(new Error("Quota exceeded for quota metric"), { status: 429 }));
      const { sendNotificationEmails } = await importEmail({ EMAIL_PROVIDER: "gmail" });

      const pending = sendNotificationEmails(people(1), "s", "h");
      await vi.advanceTimersByTimeAsync(120_000);
      const summary = await pending;

      // First try + 3 waits (5s, 20s, 45s) - no endless retrying.
      expect(gmailSendMock).toHaveBeenCalledTimes(4);
      expect(summary.failures).toEqual({ rate_limited: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not send the same address twice", async () => {
    gmailSendMock.mockResolvedValue({ data: {} });
    const { sendNotificationEmails } = await importEmail({ EMAIL_PROVIDER: "gmail" });

    await sendNotificationEmails([{ email: "a@example.com" }, { email: "a@example.com " }], "s", "h");

    expect(gmailSendMock).toHaveBeenCalledTimes(1);
  });
});
