import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canManageSchedule } from "@/lib/schedule-permissions";
import { buildEventForList } from "@/lib/schedule-view";
import AppShell from "@/components/AppShell";
import EventList from "@/components/EventList";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      categories: true,
      responses: { include: { user: { select: { name: true } } } },
      createdBy: { select: { name: true } },
      matchResult: { select: { id: true } },
    },
  });
  if (!event) notFound();

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, categories: true },
  });

  const card = buildEventForList(event, allUsers, {
    currentUserId: user.id,
    currentUserIsAdmin: user.isAdmin,
    userCategories: user.categories.map((c) => c.category),
    now: new Date(),
    lastScheduleVisitAt: user.lastScheduleVisitAt,
  });

  return (
    <AppShell user={user}>
      <Link href="/schedule" className="text-xs text-emerald-600 hover:underline">
        ← スケジュール一覧
      </Link>
      <div className="mt-3">
        <EventList events={[card]} manageAllowed={canManageSchedule(user)} />
      </div>
    </AppShell>
  );
}
