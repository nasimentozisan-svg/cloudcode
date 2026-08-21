import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.GOOGLE_SYNC_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

// Read side of the daily Google Calendar sync (see docs/INFRASTRUCTURE.md).
// Returns events from the last 2 days onward so a same-day edit still gets
// picked up, along with each event's linked googleCalendarEventId (null if
// never synced) so the sync job knows create vs. update.
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: { startAt: { gte: since } },
    select: {
      id: true,
      title: true,
      location: true,
      notes: true,
      startAt: true,
      googleCalendarEventId: true,
    },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({ events });
}
