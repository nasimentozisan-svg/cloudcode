import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { isViewOnly } from "@/lib/categories";
import AppShell from "@/components/AppShell";
import CreateChannelForm from "@/components/CreateChannelForm";

export default async function NewChannelPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isViewOnly(user.categories.map((c) => c.category))) redirect("/schedule");

  const allMembers = await prisma.user.findMany({
    where: { id: { not: user.id } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell user={user}>
      <h2 className="text-lg font-bold text-gray-900">チャンネルを追加</h2>
      <p className="mt-1 text-sm text-gray-500">
        Slackのように、目的別のチャンネルを自由に作成できます。
      </p>
      <div className="mt-4 max-w-xl rounded-xl border border-gray-200 bg-white p-5">
        <CreateChannelForm allMembers={allMembers} />
      </div>
    </AppShell>
  );
}
