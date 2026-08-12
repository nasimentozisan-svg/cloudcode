import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import UploadCardsForm from "@/components/UploadCardsForm";
import PendingCardsList from "@/components/PendingCardsList";

export default async function AdminCardsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

  const [pendingImages, users, linkedCount, totalCount] = await Promise.all([
    prisma.pendingCardImage.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.count({ where: { cardImagePath: { not: null } } }),
    prisma.user.count(),
  ]);

  return (
    <AppShell user={user}>
      <h2 className="text-lg font-bold text-gray-900">選手証の一括登録</h2>
      <p className="mt-1 text-sm text-gray-500">
        JFAの「登録選手一覧」PDFをアップロードすると、名簿に載っている名前・背番号・写真を
        読み取り、登録済みのメンバーと一致すれば自動で紐付けます。名前が一致しなかったものは
        下の「要確認」に表示されるので、手動で選手を選んで紐付けてください。
      </p>
      <p className="mt-1 text-sm text-gray-500">
        紐付け済み: {linkedCount} / {totalCount}人
      </p>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <UploadCardsForm />
      </div>

      <h2 className="mt-10 text-lg font-bold text-gray-900">
        要確認（{pendingImages.length}件）
      </h2>
      <div className="mt-4">
        <PendingCardsList
          items={pendingImages.map((p) => ({
            id: p.id,
            imageUrl: p.filePath,
            name: p.name,
            uniformNumber: p.uniformNumber,
          }))}
          users={users}
        />
      </div>
    </AppShell>
  );
}
