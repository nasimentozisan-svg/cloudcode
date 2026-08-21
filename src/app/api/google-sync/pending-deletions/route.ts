import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.GOOGLE_SYNC_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

// EFK events with a synced Google Calendar event get queued here when
// deleted (see deleteEventAction), since the Event row - and its
// googleCalendarEventId - is gone by the time the sync job runs. This is
// the only remaining record of which Google event to remove.
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const deletions = await prisma.pendingGoogleDeletion.findMany({
    select: { id: true, googleCalendarEventId: true },
  });

  return NextResponse.json({ deletions });
}

// Called by the sync job after it has actually deleted the corresponding
// Google Calendar events, so they aren't retried on the next run.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { ids?: string[] };
  if (!body.ids || body.ids.length === 0) {
    return NextResponse.json({ error: "ids is required" }, { status: 400 });
  }

  await prisma.pendingGoogleDeletion.deleteMany({ where: { id: { in: body.ids } } });

  return NextResponse.json({ ok: true });
}
