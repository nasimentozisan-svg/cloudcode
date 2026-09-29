import { afterEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: (...a: unknown[]) => findUniqueMock(...a) } },
}));
vi.mock("@/lib/session", () => ({ createSession: vi.fn(), destroySession: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { loginAction } = await import("./auth");

const form = () => {
  const f = new FormData();
  f.set("email", "member@example.com");
  f.set("password", "password123");
  return f;
};
const healthLines = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith("[health]"));

afterEach(() => {
  vi.restoreAllMocks();
  findUniqueMock.mockReset();
});

describe("loginAction health marker", () => {
  it("does not flag a wrong email/password - that's the member, not the app", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    findUniqueMock.mockResolvedValue(null);
    expect(await loginAction({}, form())).toEqual({ error: "メールアドレスまたはパスワードが違います" });
    expect(healthLines(err)).toEqual([]);
  });

  it("flags login itself breaking (DB unreachable), without the address, and fails as before", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    findUniqueMock.mockRejectedValue(Object.assign(new Error("Can't reach database"), { code: "P1001" }));
    await expect(loginAction({}, form())).rejects.toThrow("Can't reach database");
    expect(healthLines(err)).toEqual(["[health] auth_error stage=login error=P1001"]);
  });
});
