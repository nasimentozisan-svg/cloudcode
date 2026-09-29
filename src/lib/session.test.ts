import { afterEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

process.env.JWT_SECRET = "test-secret-for-session";
let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined) }),
}));

const { getSession } = await import("./session");

async function token(secret: string, exp: string | number) {
  return new SignJWT({ userId: "u1" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(secret));
}

afterEach(() => vi.restoreAllMocks());

describe("getSession health marker", () => {
  const healthLines = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith("[health]"));

  it("accepts a valid session silently", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    cookieValue = await token("test-secret-for-session", "1h");
    expect(await getSession()).toEqual({ userId: "u1" });
    expect(healthLines(err)).toEqual([]);
  });

  it("treats an expired session as routine (no marker)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    cookieValue = await token("test-secret-for-session", Math.floor(Date.now() / 1000) - 60);
    expect(await getSession()).toBeNull();
    expect(healthLines(err)).toEqual([]);
  });

  it("flags a session signed with a different secret (everyone would be logged out)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    cookieValue = await token("some-other-secret", "1h");
    expect(await getSession()).toBeNull();
    expect(healthLines(err)).toEqual(["[health] auth_error stage=session error=ERR_JWS_SIGNATURE_VERIFICATION_FAILED"]);
  });
});
