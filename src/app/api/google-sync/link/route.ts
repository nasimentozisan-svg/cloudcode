import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.GOOGLE_SYNC_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

// Called by the sync job right after it creates a new Google Calendar event
// for an EFK event, so future runs update/delete that exact event instead
// of creating duplicates.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { eventId?: string; googleCalendarEventId?: string };
  if (!body.eventId || !body.googleCalendarEventId) {
    return NextResponse.json({ error: "eventId and googleCalendarEventId are required" }, { status: 400 });
  }

  try {
    await prisma.event.update({
      where: { id: body.eventId },
      data: { googleCalendarEventId: body.googleCalendarEventId },
    });
  } catch {
    // Event was deleted between the sync job reading it and linking it -
    // harmless, the next run's pending-deletions check won't find it either
    // since it was never linked. Nothing to clean up.
    return NextResponse.json({ ok: false, reason: "event not found" });
  }

  return NextResponse.json({ ok: true });
}
