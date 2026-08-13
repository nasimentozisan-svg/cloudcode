import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { canManageSchedule } from "@/lib/schedule-permissions";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import MatchResultForm from "@/components/MatchResultForm";

export default async function MatchResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageSchedule(user)) redirect("/schedule");

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      categories: true,
      matchResult: { include: { scorers: { orderBy: { order: "asc" } } } },
    },
  });
  if (!event) notFound();

  return (
    <AppShell user={user}>
      <h2 className="text-lg font-bold text-gray-900">試合結果を入力</h2>
      <p className="mt-1 text-sm text-gray-500">{event.title}</p>
      <div className="mt-4 max-w-xl rounded-xl border border-gray-200 bg-white p-5">
        <MatchResultForm
          eventId={event.id}
          eventTitle={event.title}
          eventCategories={event.categories.map((c) => c.category)}
          startAt={event.startAt.toISOString()}
          initial={
            event.matchResult
              ? {
                  opponent: event.matchResult.opponent,
                  ourScore: event.matchResult.ourScore,
                  opponentScore: event.matchResult.opponentScore,
                  scorers: event.matchResult.scorers.map((s) => ({
                    number: s.number,
                    name: s.name,
                    goals: s.goals,
                  })),
                }
              : null
          }
        />
      </div>
    </AppShell>
  );
}
