import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canManageSchedule } from "@/lib/schedule-permissions";
import AppShell from "@/components/AppShell";
import EventList, { type EventForList } from "@/components/EventList";
import type { AttendanceStatus, Category } from "@/generated/prisma/client";

export default async function SchedulePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userCategories = user.categories.map((c) => c.category);
  const manageAllowed = canManageSchedule(user);

  const [events, allUsers] = await Promise.all([
    prisma.event.findMany({
      where: user.isAdmin
        ? {}
        : { categories: { some: { category: { in: userCategories } } } },
      include: {
        categories: true,
        responses: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.user.findMany({ select: { id: true, categories: true } }),
  ]);

  const now = new Date();
  const upcoming = events.filter((e) => e.startAt >= now);
  const past = events
    .filter((e) => e.startAt < now)
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
    .slice(0, 10);

  const currentUserId = user.id;
  const currentUserIsAdmin = user.isAdmin;

  function toEventForList(ev: (typeof events)[number]): EventForList {
    const eventCategories: Category[] = ev.categories.map((c) => c.category);
    const eligibleUserIds = new Set(
      allUsers
        .filter((u) => u.categories.some((c) => eventCategories.includes(c.category)))
        .map((u) => u.id)
    );
    const counts = { attending: 0, absent: 0, undecided: 0, noResponse: 0 };
    const respondedIds = new Set<string>();
    for (const r of ev.responses) {
      respondedIds.add(r.userId);
      if (r.status === "ATTENDING") counts.attending++;
      else if (r.status === "ABSENT") counts.absent++;
      else counts.undecided++;
    }
    for (const uid of eligibleUserIds) {
      if (!respondedIds.has(uid)) counts.noResponse++;
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
      counts,
    };
  }

  return (
    <AppShell user={user}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">スケジュール・出欠</h2>
        {manageAllowed && (
          <Link
            href="/schedule/new"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            予定を作成
          </Link>
        )}
      </div>

      <h3 className="mt-6 text-sm font-semibold text-gray-500">今後の予定</h3>
      <div className="mt-3">
        <EventList events={upcoming.map(toEventForList)} />
      </div>

      {past.length > 0 && (
        <>
          <h3 className="mt-10 text-sm font-semibold text-gray-500">過去の予定</h3>
          <div className="mt-3">
            <EventList events={past.map(toEventForList)} />
          </div>
        </>
      )}
    </AppShell>
  );
}
