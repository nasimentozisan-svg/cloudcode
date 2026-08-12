import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIcsCalendar } from "@/lib/ics";

// Calendar apps poll this URL directly (no session cookie), so access is
// gated by the unguessable per-admin token in the path rather than auth.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const user = await prisma.user.findUnique({ where: { calendarToken: token } });
  if (!user || !user.isAdmin) {
    return new NextResponse("Not found", { status: 404 });
  }

  const events = await prisma.event.findMany({
    orderBy: { startAt: "asc" },
  });

  const ics = buildIcsCalendar("EFK members", events);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="efk-members.ics"',
      "Cache-Control": "no-store",
    },
  });
}
