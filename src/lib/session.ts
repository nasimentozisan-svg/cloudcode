import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { errorCode, reportHealth } from "@/lib/health";

const SESSION_COOKIE = "futsal_session";
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export type SessionPayload = {
  userId: string;
};

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId };
  } catch (error) {
    // An expired session is routine (30 days) - the member just logs in
    // again. Anything else (bad signature, missing JWT_SECRET, ...) could
    // mean everyone is being logged out, so flag it.
    const code = errorCode(error);
    if (!code.includes("ERR_JWT_EXPIRED")) reportHealth("auth_error", { stage: "session", error: code });
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
