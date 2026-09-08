import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

const { handleEvent } = await import("./route");

function textEvent(text: string, opts: Partial<{ userId: string; replyToken: string }> = {}) {
  return {
    type: "message",
    replyToken: "reply-token" in opts ? opts.replyToken : "reply-token",
    source: { userId: opts.userId ?? "line-user-1" },
    message: { type: "text", text },
  };
}

describe("LINE webhook handleEvent (account linking)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findUniqueMock.mockReset();
    updateMock.mockReset();
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("links the account and replies with success when the code matches", async () => {
    findUniqueMock.mockResolvedValue({ id: "user-1", name: "山田" });
    updateMock.mockResolvedValue({});

    await handleEvent(textEvent("ABCD1234"));

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { lineUserId: "line-user-1", lineLinkCode: null },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const replyBody = JSON.parse(init.body as string);
    expect(replyBody.messages[0].text).toContain("連携しました");
  });

  it("looks up the code case-insensitively", async () => {
    findUniqueMock.mockResolvedValue({ id: "user-1", name: "山田" });
    updateMock.mockResolvedValue({});

    await handleEvent(textEvent("abcd1234"));

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { lineLinkCode: "ABCD1234" } });
  });

  it("replies with a clear message instead of crashing when this LINE account is already linked elsewhere", async () => {
    findUniqueMock.mockResolvedValue({ id: "user-1", name: "山田" });
    updateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    await expect(handleEvent(textEvent("ABCD1234"))).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const replyBody = JSON.parse(init.body as string);
    expect(replyBody.messages[0].text).toContain("既に別の");
  });

  it("propagates an unexpected DB error so the caller's try/catch can log it", async () => {
    findUniqueMock.mockResolvedValue({ id: "user-1", name: "山田" });
    updateMock.mockRejectedValue(new Error("connection refused"));

    await expect(handleEvent(textEvent("ABCD1234"))).rejects.toThrow("connection refused");
  });

  it("replies that the code wasn't found, without touching the database further", async () => {
    findUniqueMock.mockResolvedValue(null);

    await handleEvent(textEvent("NOPE0000"));

    expect(updateMock).not.toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const replyBody = JSON.parse(init.body as string);
    expect(replyBody.messages[0].text).toContain("見つかりませんでした");
  });

  it("ignores non-text events without touching the database", async () => {
    await handleEvent({ type: "follow", source: { userId: "line-user-1" } });

    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
