import { afterEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/require-admin", () => ({ requireAdmin: () => requireAdminMock() }));
const grantMock = vi.fn();
vi.mock("@/lib/google-calendar", () => ({
  isGoogleSyncConfigured: () => true,
  getGoogleGrantStatus: () => grantMock(),
}));
const sendMock = vi.fn();
vi.mock("@/lib/email", () => ({ sendEmailsVia: (...a: unknown[]) => sendMock(...a) }));

afterEach(() => {
  requireAdminMock.mockReset();
  grantMock.mockReset();
  sendMock.mockReset();
  vi.restoreAllMocks();
});

describe("sendTestEmailAction", () => {
  it("sends exactly one Gmail message, only to the logged-in admin", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    requireAdminMock.mockResolvedValue({ id: "a1", email: "admin@example.com", isAdmin: true });
    grantMock.mockResolvedValue({ calendar: true, gmailSend: true });
    sendMock.mockResolvedValue({ provider: "gmail", target: 1, sent: 1, failures: {} });
    const { sendTestEmailAction } = await import("./email-test");

    expect(await sendTestEmailAction()).toEqual({ state: "sent" });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [provider, recipients] = sendMock.mock.calls[0];
    expect(provider).toBe("gmail");
    expect(recipients).toEqual([{ email: "admin@example.com" }]);
  });

  it("sends nothing until the Google token has gmail.send", async () => {
    requireAdminMock.mockResolvedValue({ id: "a1", email: "admin@example.com", isAdmin: true });
    grantMock.mockResolvedValue({ calendar: true, gmailSend: false });
    const { sendTestEmailAction } = await import("./email-test");

    expect(await sendTestEmailAction()).toEqual({ state: "no_permission" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("refuses non-admins", async () => {
    requireAdminMock.mockRejectedValue(new Error("管理者権限が必要です"));
    const { sendTestEmailAction } = await import("./email-test");

    await expect(sendTestEmailAction()).rejects.toThrow("管理者権限が必要です");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("never logs the email address", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    requireAdminMock.mockResolvedValue({ id: "a1", email: "admin@example.com", isAdmin: true });
    grantMock.mockResolvedValue({ calendar: true, gmailSend: true });
    sendMock.mockResolvedValue({ provider: "gmail", target: 1, sent: 1, failures: {} });
    const { sendTestEmailAction } = await import("./email-test");

    await sendTestEmailAction();
    expect(logSpy.mock.calls.flat().join(" ")).not.toContain("admin@example.com");
  });
});
