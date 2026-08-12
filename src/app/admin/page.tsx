import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminUserTable from "@/components/AdminUserTable";
import AdminCreateUserForm from "@/components/AdminCreateUserForm";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <AppShell user={user}>
      <h2 className="text-lg font-bold text-gray-900">
        メンバー一覧（{users.length}人）
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        カテゴリーの変更・管理者権限の付与/剥奪ができます。
      </p>
      <div className="mt-4">
        <AdminUserTable users={users} currentUserId={user.id} />
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
    </AppShell>
  );
}
