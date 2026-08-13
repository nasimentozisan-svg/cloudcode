import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canManageSchedule, canRespondToEvent } from "@/lib/schedule-permissions";
import { categoryGroups } from "@/lib/categories";
import AppShell from "@/components/AppShell";
import EventList, { type EventForList } from "@/components/EventList";
import ScheduleCalendar, { type CalendarEvent } from "@/components/ScheduleCalendar";
import type { AttendanceStatus, Category } from "@/generated/prisma/client";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userCategories = user.categories.map((c) => c.category);
  const manageAllowed = canManageSchedule(user);

  const { month: monthParam } = await searchParams;
  const now = new Date();
  let calendarYear = now.getFullYear();
  let calendarMonth = now.getMonth() + 1;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    calendarYear = y;
    calendarMonth = m;
  }

  // すべてのカテゴリーの予定を全員が閲覧できるようにする（回答できるのは対象カテゴリーの人のみ）
  const [events, allUsers] = await Promise.all([
    prisma.event.findMany({
      include: {
        categories: true,
        responses: { include: { user: { select: { name: true } } } },
        createdBy: { select: { name: true } },
        matchResult: { select: { id: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.user.findMany({ select: { id: true, name: true, categories: true } }),
  ]);

  const upcoming = events.filter((e) => e.startAt >= now);
  const past = events
    .filter((e) => e.startAt < now)
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
    .slice(0, 10);

  const currentUserId = user.id;
  const currentUserIsAdmin = user.isAdmin;

  function toEventForList(ev: (typeof events)[number]): EventForList {
    const eventCategories: Category[] = ev.categories.map((c) => c.category);
    const eligibleUsers = allUsers.filter((u) =>
      canRespondToEvent(u.categories.map((c) => c.category), eventCategories)
    );
    const counts = { attending: 0, absent: 0, undecided: 0, noResponse: 0 };
    const attendingNames: string[] = [];
    const absentNames: string[] = [];
    const undecidedNames: string[] = [];
    const respondedIds = new Set<string>();
    for (const r of ev.responses) {
      respondedIds.add(r.userId);
      if (r.status === "ATTENDING") {
        counts.attending++;
        attendingNames.push(r.user.name);
      } else if (r.status === "ABSENT") {
        counts.absent++;
        absentNames.push(r.user.name);
      } else {
        counts.undecided++;
        undecidedNames.push(r.user.name);
      }
    }
    const noResponseNames: string[] = [];
    for (const u of eligibleUsers) {
      if (!respondedIds.has(u.id)) {
        counts.noResponse++;
        noResponseNames.push(u.name);
      }
    }

    const myResponse: AttendanceStatus | null =
      ev.responses.find((r) => r.userId === currentUserId)?.status ?? null;

    return {
      id: ev.id,
      title: ev.title,
      location: ev.location,
      notes: ev.notes,
      startAt: ev.startAt.toISOString(),
      createdByName: ev.createdBy.name,
      categories: eventCategories,
      myResponse,
      canDelete: currentUserIsAdmin || ev.createdById === currentUserId,
      eligible: canRespondToEvent(userCategories, eventCategories),
      isPast: ev.startAt < now,
      hasMatchResult: ev.matchResult !== null,
      counts,
      attendingNames,
      absentNames,
      undecidedNames,
      noResponseNames,
    };
  }

  const calendarEvents: CalendarEvent[] = events
    .filter(
      (ev) =>
        ev.startAt.getFullYear() === calendarYear && ev.startAt.getMonth() + 1 === calendarMonth
    )
    .map((ev) => {
      const eventCategories = ev.categories.map((c) => c.category);
      const eligible = canRespondToEvent(userCategories, eventCategories);
      const myResponse = ev.responses.find((r) => r.userId === currentUserId)?.status ?? null;
      return {
        id: ev.id,
        title: ev.title,
        day: ev.startAt.getDate(),
        groups: categoryGroups(eventCategories),
        needsResponse: eligible && ev.startAt >= now && myResponse === null,
      };
    });

  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return (
    <AppShell user={user}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">スケジュール・出欠</h2>
        {manageAllowed && (
          <div className="flex gap-2">
            <Link
              href="/schedule/import"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              まとめてインポート
            </Link>
            <Link
              href="/schedule/new"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
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
