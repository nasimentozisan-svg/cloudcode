import { afterEach, describe, expect, it, vi } from "vitest";
import { errorCode, formatHealthLine, isGoogleAuthFailure, reportHealth, reportHealthOk } from "./health";

afterEach(() => vi.restoreAllMocks());

describe("formatHealthLine", () => {
  it("is a single greppable line with a stable [health] <kind> prefix", () => {
    expect(formatHealthLine("push_failed", { devices: 3, sent: 1, failed: 2 })).toBe(
      "[health] push_failed devices=3 sent=1 failed=2"
    );
  });

  it("squashes each value to one token so a field can't carry a free-text message or break the format", () => {
    const line = formatHealthLine("auth_error", { error: "bad thing\nhappened: see <details>", empty: "", none: null });
    expect(line).toBe("[health] auth_error error=bad_thing_happened:_see_details_");
    expect(line).not.toContain("\n");
  });

  it("logs problems at error level (grouped errors view) and ok markers at normal level", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    reportHealth("slow", { route: "/schedule", total_ms: 6123 });
    reportHealthOk("calendar_sync", { created: 1 });
    expect(err).toHaveBeenCalledWith("[health] slow route=/schedule total_ms=6123");
    expect(log).toHaveBeenCalledWith("[health-ok] calendar_sync created=1");
  });
});

describe("errorCode", () => {
  it("uses Google's OAuth error code and HTTP status, not the message", () => {
    const gaxios = Object.assign(new Error("invalid_grant: Token has been expired or revoked."), {
      response: { status: 400, data: { error: "invalid_grant", error_description: "Token has been expired or revoked." } },
    });
    expect(errorCode(gaxios)).toBe("400_invalid_grant");
    expect(isGoogleAuthFailure(gaxios)).toBe(true);
  });

  it("uses library error codes (jose, Prisma)", () => {
    expect(errorCode(Object.assign(new Error("\"exp\" claim timestamp check failed"), { code: "ERR_JWT_EXPIRED" }))).toBe(
      "ERR_JWT_EXPIRED"
    );
    expect(errorCode(Object.assign(new Error("Can't reach database server at host"), { code: "P1001" }))).toBe("P1001");
  });

  it("falls back to the error class name, never the message", () => {
    expect(errorCode(new TypeError("user@example.com not found"))).toBe("TypeError");
    expect(errorCode("oops")).toBe("unknown");
  });

  it("does not treat an ordinary Google API failure as a broken OAuth grant", () => {
    const quota = Object.assign(new Error("Rate Limit Exceeded"), { response: { status: 403, data: {} }, code: 403 });
    expect(isGoogleAuthFailure(quota)).toBe(false);
    expect(isGoogleAuthFailure(Object.assign(new Error("x"), { response: { status: 401, data: {} } }))).toBe(true);
  });
});
