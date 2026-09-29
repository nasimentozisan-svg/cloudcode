import { afterEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();
const deleteMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { pushSubscription: { findFirst: (...a: unknown[]) => findFirstMock(...a), delete: (...a: unknown[]) => deleteMock(...a) } },
}));
const sendNotificationMock = vi.fn();
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotificationMock(...a) },
}));

process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
process.env.VAPID_PRIVATE_KEY = "priv";

const sub = { id: "s1", userId: "me", endpoint: "https://push.example/abc", p256dh: "p", auth: "a" };
const payload = { title: "t", body: "b", url: "/schedule" };

afterEach(() => {
  findFirstMock.mockReset();
  deleteMock.mockReset();
  sendNotificationMock.mockReset();
});

describe("sendPushToOwnDevice", () => {
  it("sends exactly one push, looked up by this user's id AND this endpoint", async () => {
    findFirstMock.mockResolvedValue(sub);
    sendNotificationMock.mockResolvedValue({ statusCode: 201 });
    const { sendPushToOwnDevice } = await import("./push");

    expect(await sendPushToOwnDevice("me", sub.endpoint, payload)).toBe("sent");
    expect(findFirstMock).toHaveBeenCalledWith({ where: { endpoint: sub.endpoint, userId: "me" } });
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock.mock.calls[0][0]).toMatchObject({ endpoint: sub.endpoint });
  });

  it("sends nothing when the endpoint isn't registered to this user (e.g. another member's device)", async () => {
    findFirstMock.mockResolvedValue(null);
    const { sendPushToOwnDevice } = await import("./push");

    expect(await sendPushToOwnDevice("me", "https://push.example/someone-else", payload)).toBe("not_registered");
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("removes an expired registration and reports it", async () => {
    findFirstMock.mockResolvedValue(sub);
    deleteMock.mockResolvedValue({});
    sendNotificationMock.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    const { sendPushToOwnDevice } = await import("./push");

    expect(await sendPushToOwnDevice("me", sub.endpoint, payload)).toBe("expired");
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});
