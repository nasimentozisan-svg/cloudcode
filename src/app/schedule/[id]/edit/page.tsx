import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canManageSchedule } from "@/lib/schedule-permissions";
import { toJSTDatetimeLocalValue } from "@/lib/datetime";
import AppShell from "@/components/AppShell";
import EditEventForm from "@/components/EditEventForm";

export default async function EditEventPage({
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
    include: { categories: true },
  });
  if (!event) notFound();

  return (
    <AppShell user={user}>
      <Link href={`/schedule/${id}`} className="text-xs text-emerald-600 hover:underline active:text-emerald-800">
        ← 予定に戻る
      </Link>
      <h2 className="mt-1 text-lg font-bold text-gray-900">予定を編集</h2>
      <div className="mt-4 max-w-xl rounded-xl border border-gray-200 bg-white p-5">
        <EditEventForm
          eventId={event.id}
          initialTitle={event.title}
          initialStartAt={toJSTDatetimeLocalValue(event.startAt)}
          initialLocation={event.location ?? ""}
          initialNotes={event.notes ?? ""}
          initialCategories={event.categories.map((c) => c.category)}
        />
      </div>
    </AppShell>
  );
}
