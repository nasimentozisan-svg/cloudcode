import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const pendingFindMany = vi.fn();
const eventFindMany = vi.fn();
const eventUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pendingGoogleDeletion: { findMany: (...a: unknown[]) => pendingFindMany(...a), delete: vi.fn() },
    event: { findMany: (...a: unknown[]) => eventFindMany(...a), update: (...a: unknown[]) => eventUpdate(...a) },
  },
}));

const eventsUpdate = vi.fn();
const eventsInsert = vi.fn();
vi.mock("@/lib/google-calendar", () => ({
  isGoogleSyncConfigured: () => true,
  getCalendarClient: () => ({
    events: { update: (...a: unknown[]) => eventsUpdate(...a), insert: (...a: unknown[]) => eventsInsert(...a), delete: vi.fn() },
  }),
}));

process.env.CRON_SECRET = "cron-secret";
const { GET } = await import("./route");

const request = () =>
  new NextRequest("https://example.test/api/cron/google-calendar-sync", {
    headers: { authorization: "Bearer cron-secret" },
  });

const event = (id: string, googleCalendarEventId: string | null) => ({
  id,
  title: "練習",
  location: null,
  notes: null,
  startAt: new Date("2026-10-01T10:00:00Z"),
  googleCalendarEventId,
});

let errorSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
const healthLines = () => errorSpy.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith("[health]"));

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  pendingFindMany.mockResolvedValue([]);
});
afterEach(() => {
  vi.restoreAllMocks();
  pendingFindMany.mockReset();
  eventFindMany.mockReset();
  eventUpdate.mockReset();
  eventsUpdate.mockReset();
  eventsInsert.mockReset();
});

describe("google-calendar-sync health markers", () => {
  it("logs a single ok marker (not an error) on a clean run, response unchanged", async () => {
    eventFindMany.mockResolvedValue([event("e1", "g1"), event("e2", null)]);
    eventsUpdate.mockResolvedValue({});
    eventsInsert.mockResolvedValue({ data: { id: "g2" } });

    const res = await GET(request());
    expect(await res.json()).toEqual({ ok: true, created: 1, updated: 1, deleted: 0 });
    expect(healthLines()).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith("[health-ok] calendar_sync created=1 updated=1 deleted=0");
  });

  it("flags a revoked Google grant as both a sync failure and an OAuth problem", async () => {
    eventFindMany.mockResolvedValue([event("e1", "g1"), event("e2", "g2")]);
    eventsUpdate.mockRejectedValue(
      Object.assign(new Error("invalid_grant"), { response: { status: 400, data: { error: "invalid_grant" } } })
    );

    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(healthLines()).toEqual([
      "[health] calendar_sync_failed stage=items failed=2 created=0 updated=0 deleted=0 error=400_invalid_grant",
      "[health] google_auth_error source=calendar_sync error=400_invalid_grant",
    ]);
  });

  it("flags a run that dies outright and still fails the request as before", async () => {
    eventFindMany.mockRejectedValue(Object.assign(new Error("Can't reach database"), { code: "P1001" }));

    await expect(GET(request())).rejects.toThrow("Can't reach database");
    expect(healthLines()).toEqual(["[health] calendar_sync_failed stage=run error=P1001"]);
  });
});
