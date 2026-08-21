import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCalendarClient, isGoogleSyncConfigured } from "@/lib/google-calendar";
import { JST_TIMEZONE } from "@/lib/datetime";

export const dynamic = "force-dynamic";

// Practices/matches don't have a stored end time, only a start - 2 hours is
// a reasonable default block for a futsal club's calendar entries.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;
// Small backward buffer so an event that started a little while ago (still
// relevant "today") doesn't get skipped just because startAt already passed.
const SYNC_WINDOW_START_MS = 24 * 60 * 60 * 1000;

function toGoogleEventBody(event: {
  title: string;
  location: string | null;
  notes: string | null;
  startAt: Date;
}) {
  const end = new Date(event.startAt.getTime() + DEFAULT_DURATION_MS);
  return {
    summary: event.title,
    location: event.location ?? undefined,
    description: event.notes ?? undefined,
    start: { dateTime: event.startAt.toISOString(), timeZone: JST_TIMEZONE },
    end: { dateTime: end.toISOString(), timeZone: JST_TIMEZONE },
  };
}

// Triggered daily at 8:00 JST by Vercel Cron (see vercel.json). Only ever
// touches Google Calendar events that this job itself created (tracked via
// Event.googleCalendarEventId, or queued in PendingGoogleDeletion at
// delete-time) - never anything a person typed directly into the club's
// Google account.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isGoogleSyncConfigured()) {
    return NextResponse.json({ ok: true, skipped: "not configured" });
  }

  const calendar = getCalendarClient();

  const pendingDeletions = await prisma.pendingGoogleDeletion.findMany();
  let deleted = 0;
  for (const pending of pendingDeletions) {
    try {
      await calendar.events.delete({
        calendarId: "primary",
        eventId: pending.googleCalendarEventId,
      });
      deleted++;
    } catch (error) {
      // 404/410 = already gone on the Google side, nothing left to do.
      const status = (error as { code?: number })?.code;
      if (status !== 404 && status !== 410) {
        console.error("Google Calendar delete failed", pending.googleCalendarEventId, error);
        continue;
      }
    }
    await prisma.pendingGoogleDeletion.delete({ where: { id: pending.id } });
  }

  const events = await prisma.event.findMany({
    where: { startAt: { gte: new Date(Date.now() - SYNC_WINDOW_START_MS) } },
  });

  let created = 0;
  let updated = 0;
  for (const event of events) {
    const body = toGoogleEventBody(event);
    if (event.googleCalendarEventId) {
      try {
        await calendar.events.update({
          calendarId: "primary",
          eventId: event.googleCalendarEventId,
          requestBody: body,
        });
        updated++;
        continue;
      } catch (error) {
        const status = (error as { code?: number })?.code;
        if (status !== 404 && status !== 410) {
          console.error("Google Calendar update failed", event.id, error);
          continue;
        }
        // Fell off the Google side somehow - fall through and recreate it.
      }
    }
    try {
      const res = await calendar.events.insert({ calendarId: "primary", requestBody: body });
      const googleId = res.data.id;
      if (googleId) {
        await prisma.event.update({
          where: { id: event.id },
          data: { googleCalendarEventId: googleId },
        });
        created++;
      }
    } catch (error) {
      console.error("Google Calendar create failed", event.id, error);
    }
  }

  return NextResponse.json({ ok: true, created, updated, deleted });
}
