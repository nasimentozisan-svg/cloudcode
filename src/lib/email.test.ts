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

  it("does not send the same address twice", async () => {
    gmailSendMock.mockResolvedValue({ data: {} });
    const { sendNotificationEmails } = await importEmail({ EMAIL_PROVIDER: "gmail" });

    await sendNotificationEmails([{ email: "a@example.com" }, { email: "a@example.com " }], "s", "h");

    expect(gmailSendMock).toHaveBeenCalledTimes(1);
  });
});
