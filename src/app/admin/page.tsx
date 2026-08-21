import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminUserTable from "@/components/AdminUserTable";
import AdminCreateUserForm from "@/components/AdminCreateUserForm";
import { calculateAttendanceRate, type AttendanceRate } from "@/lib/attendance";
import { isGoogleSyncConfigured } from "@/lib/google-calendar";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

  const [users, pastEvents] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ uniformNumber: { sort: "asc", nulls: "last" } }, { name: "asc" }],
      include: { categories: true },
    }),
    prisma.event.findMany({
      where: { startAt: { lt: new Date() } },
      include: { categories: true, responses: true },
    }),
  ]);

  const attendanceRates: Record<string, AttendanceRate> = {};
  for (const u of users) {
    attendanceRates[u.id] = calculateAttendanceRate(
      u.id,
      u.categories.map((c) => c.category),
      pastEvents
    );
  }

  return (
    <AppShell user={user}>
      <h2 className="text-lg font-bold text-gray-900">
        メンバー一覧（{users.length}人）
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        カテゴリーの変更・管理者権限の付与/剥奪ができます。出席率は自分のカテゴリー対象の過去の予定のうち「出席」と回答した割合です。
      </p>
      <div className="mt-4">
        <AdminUserTable users={users} currentUserId={user.id} attendanceRates={attendanceRates} />
      </div>

      <h2 className="mt-10 text-lg font-bold text-gray-900">
        アカウントを手動追加
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        本人が自分で登録できない場合に、管理者側でアカウントを作成できます。
      </p>
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <AdminCreateUserForm />
      </div>

      <h2 className="mt-10 text-lg font-bold text-gray-900">
        Googleカレンダー連携
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        毎日8:00にスケジュールの予定を自動でGoogleカレンダー（emfrentekumamotoアカウント）に反映します。手入力した予定には触れません。
      </p>
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        {isGoogleSyncConfigured() ? (
          <p className="text-sm text-green-700">連携設定済みです。毎日自動で同期されます。</p>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              まだ連携が完了していません。Vercelの環境変数に
              <code className="mx-1 rounded bg-gray-100 px-1">GOOGLE_OAUTH_CLIENT_ID</code>
              と
              <code className="mx-1 rounded bg-gray-100 px-1">GOOGLE_OAUTH_CLIENT_SECRET</code>
              を設定してデプロイした後、下のボタンから一度だけ許可してください。
            </p>
            <a
              href="/api/admin/google-calendar-authorize"
              className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Googleカレンダーへのアクセスを許可する
            </a>
          </>
        )}
      </div>
    </AppShell>
  );
}
