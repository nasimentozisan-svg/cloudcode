import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { canManageSchedule } from "@/lib/schedule-permissions";
import AppShell from "@/components/AppShell";
import CreateEventForm from "@/components/CreateEventForm";

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageSchedule(user)) redirect("/schedule");

  return (
    <AppShell user={user}>
      <h2 className="text-lg font-bold text-gray-900">予定を作成</h2>
      <p className="mt-1 text-sm text-gray-500">
        対象カテゴリーのメンバーに予定が表示され、出欠を回答してもらえます。
      </p>
      <div className="mt-4 max-w-xl rounded-xl border border-gray-200 bg-white p-5">
        <CreateEventForm />
      </div>
    </AppShell>
  );
}
