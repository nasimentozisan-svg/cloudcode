import Link from "next/link";
import { startTiming } from "@/lib/timing";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canManageSchedule, canRespondToEvent } from "@/lib/schedule-permissions";
import { categoryGroups, sortGroupsForViewer } from "@/lib/categories";
import { buildEventForList } from "@/lib/schedule-view";
import { getReadEventIds } from "@/lib/unread";
import { getJSTDateParts } from "@/lib/datetime";
import { getHolidayDaysInMonth } from "@/lib/holidays";
import AppShell from "@/components/AppShell";
import EventList from "@/components/EventList";
import ScheduleCalendar, { type CalendarEvent } from "@/components/ScheduleCalendar";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const timing = startTiming("/schedule");
  const user = await getCurrentUser();
  timing.authDone();
  if (!user) redirect("/login");

  const userCategories = user.categories.map((c) => c.category);
  const manageAllowed = canManageSchedule(user);

  const { month: monthParam } = await searchParams;
  const now = new Date();
  const nowParts = getJSTDateParts(now);
  let calendarYear = nowParts.year;
  let calendarMonth = nowParts.month;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    calendarYear = y;
    calendarMonth = m;
  }

  // すべてのカテゴリーの予定を全員が閲覧できるようにする（回答できるのは対象カテゴリーの人のみ）
  const [rawEvents, allUsers, readEventIds] = await Promise.all([
    prisma.event.findMany({
      include: {
        categories: true,
        // Responder names come from allUsers below rather than a per-response
        // user join: with a season of events that join was most of this
        // page's load time (~165ms of DB time at 400 events/22k answers).
        responses: { select: { userId: true, status: true } },
        createdBy: { select: { name: true } },
        matchResult: { select: { id: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.user.findMany({ select: { id: true, name: true, categories: true } }),
    getReadEventIds(user.id),
  ]);
  const nameById = new Map(allUsers.map((u) => [u.id, u.name]));
  const events = rawEvents.map((ev) => ({
    ...ev,
    responses: ev.responses.map((r) => ({ ...r, user: { name: nameById.get(r.userId) ?? "" } })),
  }));

  const upcoming = events.filter((e) => e.startAt >= now);
  const past = events
    .filter((e) => e.startAt < now)
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
    .slice(0, 10);

  // Color priority also considers a guardian's chosen child categories (but
  // NOT eligibility/response permissions - those stay purely based on the
  // viewer's own categories, computed separately above).
  const userGroups = categoryGroups([...userCategories, ...user.guardianChildCategories]);

  const listCtx = {
    currentUserId: user.id,
    currentUserIsAdmin: user.isAdmin,
    userCategories,
    now,
    readEventIds,
  };
  const toEventForList = (ev: (typeof events)[number]) => buildEventForList(ev, allUsers, listCtx);

  const calendarEvents: CalendarEvent[] = events
    .filter((ev) => {
      const parts = getJSTDateParts(ev.startAt);
      return parts.year === calendarYear && parts.month === calendarMonth;
    })
    .map((ev) => {
      const eventCategories = ev.categories.map((c) => c.category);
      const eligible = canRespondToEvent(userCategories, eventCategories);
      const myResponse = ev.responses.find((r) => r.userId === user.id)?.status ?? null;
      return {
        id: ev.id,
        title: ev.title,
        day: getJSTDateParts(ev.startAt).day,
        groups: sortGroupsForViewer(categoryGroups(eventCategories), userGroups),
        needsResponse: eligible && ev.startAt >= now && myResponse === null,
        isNew: !readEventIds.has(ev.id),
      };
    });

  const todayKey = `${nowParts.year}-${pad(nowParts.month)}-${pad(nowParts.day)}`;
  const holidayDays = getHolidayDaysInMonth(calendarYear, calendarMonth);

  // Marks every event shown on this page as read - uses the readEventIds
  // snapshot captured above, so this render still shows accurate NEW badges
  // for anything that was unread up until now. Run after the response via
  // after() (not @vercel/functions' waitUntil, which is a no-op outside
  // Vercel and so never even starts Prisma's lazy query there).
  after(() =>
    prisma.eventRead.createMany({
      data: events.map((e) => ({ userId: user.id, eventId: e.id })),
      skipDuplicates: true,
    })
  );

  timing.end();
  return (
    <AppShell user={user}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">スケジュール・出欠</h2>
        {manageAllowed && (
          <div className="flex gap-2">
            <Link
              href="/schedule/import"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              まとめてインポート
            </Link>
            <Link
              href="/schedule/new"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800"
            >
              予定を作成
            </Link>
          </div>
        )}
      </div>

      <div className="mt-4">
        <ScheduleCalendar
          year={calendarYear}
          month={calendarMonth}
          events={calendarEvents}
          todayKey={todayKey}
          holidayDays={holidayDays}
        />
      </div>

      <h3 className="mt-8 text-sm font-semibold text-gray-500">今後の予定</h3>
      <div className="mt-3">
        <EventList events={upcoming.map(toEventForList)} manageAllowed={manageAllowed} />
      </div>

      {past.length > 0 && (
        <>
          <h3 className="mt-10 text-sm font-semibold text-gray-500">過去の予定</h3>
          <div className="mt-3">
            <EventList events={past.map(toEventForList)} manageAllowed={manageAllowed} />
          </div>
        </>
      )}
    </AppShell>
  );
}
