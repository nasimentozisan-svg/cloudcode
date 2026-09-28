import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { canManageSchedule } from "@/lib/schedule-permissions";
import AppShell from "@/components/AppShell";
import ScheduleImportForm from "@/components/ScheduleImportForm";

export default async function ScheduleImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageSchedule(user)) redirect("/schedule");

  return (
    <AppShell user={user}>
      <h2 className="text-lg font-bold text-gray-900">日程をまとめてインポート</h2>
      <p className="mt-1 text-sm text-gray-500">
        試合日程表のテキストを貼り付けて、まとめて予定を登録できます。
      </p>
      <div className="mt-4 max-w-2xl rounded-xl border border-gray-200 bg-white p-5">
        <ScheduleImportForm />
      </div>
    </AppShell>
  );
}
