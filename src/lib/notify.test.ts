import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}));

const sendNotificationEmailsMock = vi.fn();
vi.mock("@/lib/email", () => ({
  sendNotificationEmails: (...args: unknown[]) => sendNotificationEmailsMock(...args),
}));

const sendPushToUsersMock = vi.fn();
vi.mock("@/lib/push", () => ({
  sendPushToUsers: (...args: unknown[]) => sendPushToUsersMock(...args),
}));

const sendLineMessagesMock = vi.fn();
vi.mock("@/lib/line", () => ({
  sendLineMessages: (...args: unknown[]) => sendLineMessagesMock(...args),
}));

const { notifyRecipients } = await import("./notify");

const email = { subject: "件名", html: "<p>本文</p>" };
const push = { title: "タイトル", body: "本文" };
const lineText = "LINE本文";

const recipients = [
  { id: "u1", email: "u1@example.com", receiveEmailNotifications: true },
  { id: "u2", email: "u2@example.com", receiveEmailNotifications: true },
  { id: "u3", email: "u3@example.com", receiveEmailNotifications: false },
];

describe("notifyRecipients", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    sendNotificationEmailsMock.mockReset().mockResolvedValue(undefined);
    sendPushToUsersMock.mockReset().mockResolvedValue(undefined);
    sendLineMessagesMock.mockReset().mockResolvedValue([]);
  });

  it("only attempts LINE push for recipients who have actually linked an account", async () => {
    // u2 is a real recipient but never finished linking LINE - the query
    // must exclude them from what gets attempted (an unlinked user isn't a
    // "failure", it's a target that was never reachable in the first place).
    findManyMock.mockResolvedValue([{ lineUserId: "line-u1" }, { lineUserId: "line-u3" }]);
    sendLineMessagesMock.mockResolvedValue([{ ok: true }, { ok: true }]);

    await notifyRecipients(recipients, email, push, lineText);

    expect(sendLineMessagesMock).toHaveBeenCalledTimes(1);
    expect(sendLineMessagesMock).toHaveBeenCalledWith(["line-u1", "line-u3"], lineText);
  });

  it("still delivers email and push when one recipient's LINE send fails", async () => {
    findManyMock.mockResolvedValue([{ lineUserId: "line-u1" }, { lineUserId: "line-u2" }]);
    sendLineMessagesMock.mockResolvedValue([
      { ok: true },
      { ok: false, reason: "http_error", status: 400 },
    ]);

    await expect(notifyRecipients(recipients, email, push, lineText)).resolves.toBeUndefined();

    expect(sendNotificationEmailsMock).toHaveBeenCalledTimes(1);
    expect(sendPushToUsersMock).toHaveBeenCalledTimes(1);
  });

  it("does not throw, and still delivers email/push, when the LINE call rejects outright", async () => {
    findManyMock.mockResolvedValue([{ lineUserId: "line-u1" }]);
    sendLineMessagesMock.mockRejectedValue(new Error("network down"));

    await expect(notifyRecipients(recipients, email, push, lineText)).resolves.toBeUndefined();

    expect(sendNotificationEmailsMock).toHaveBeenCalledTimes(1);
    expect(sendPushToUsersMock).toHaveBeenCalledTimes(1);
  });

  it("calls each channel exactly once per invocation (no duplicate sends for one event)", async () => {
    findManyMock.mockResolvedValue([]);

    await notifyRecipients(recipients, email, push, lineText);

    expect(sendNotificationEmailsMock).toHaveBeenCalledTimes(1);
    expect(sendPushToUsersMock).toHaveBeenCalledTimes(1);
    expect(sendLineMessagesMock).toHaveBeenCalledTimes(1);
  });

  it("only emails recipients who opted into email notifications", async () => {
    findManyMock.mockResolvedValue([]);

    await notifyRecipients(recipients, email, push, lineText);

    expect(sendNotificationEmailsMock).toHaveBeenCalledWith(
      [
        { id: "u1", email: "u1@example.com", receiveEmailNotifications: true },
        { id: "u2", email: "u2@example.com", receiveEmailNotifications: true },
      ],
      email.subject,
      email.html
    );
  });

  it("does nothing when there are no recipients", async () => {
    await notifyRecipients([], email, push, lineText);

    expect(findManyMock).not.toHaveBeenCalled();
    expect(sendNotificationEmailsMock).not.toHaveBeenCalled();
    expect(sendPushToUsersMock).not.toHaveBeenCalled();
    expect(sendLineMessagesMock).not.toHaveBeenCalled();
  });
});
