import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import { formatCategories } from "@/lib/categories";
import { canAccessChannel, ensureDefaultChannels } from "@/lib/channels";

const STATUS_LABELS: Record<string, string> = {
  ATTENDING: "出席",
  ABSENT: "欠席",
  UNDECIDED: "未定",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userCategories = user.categories.map((c) => c.category);
  const upcomingEvents = await prisma.event.findMany({
    where: {
      startAt: { gte: new Date() },
      ...(user.isAdmin
        ? {}
        : { categories: { some: { category: { in: userCategories } } } }),
    },
    include: { responses: { where: { userId: user.id } } },
    orderBy: { startAt: "asc" },
    take: 3,
  });

  await ensureDefaultChannels();
  const allChannels = await prisma.channel.findMany({
    include: { categories: true, _count: { select: { messages: true } } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  const channels = allChannels.filter((c) => canAccessChannel(user, c));

  return (
    <AppShell user={user}>
      <div className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row">
        {user.cardImagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.cardImagePath}
            alt="選手証"
            width={160}
            height={200}
            className="mx-auto rounded-md object-cover sm:mx-0"
          />
        ) : (
          <div className="mx-auto flex h-[200px] w-[160px] shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-center text-xs text-gray-400 sm:mx-0">
            選手証
            <br />
            未アップロード
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">マイプロフィール</h2>
          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
            <dt className="text-gray-500">名前</dt>
            <dd className="col-span-1 sm:col-span-3">{user.name}</dd>
            <dt className="text-gray-500">カテゴリー</dt>
            <dd className="col-span-1 sm:col-span-3">
              {formatCategories(user.categories.map((c) => c.category))}
            </dd>
            <dt className="text-gray-500">背番号</dt>
            <dd className="col-span-1 sm:col-span-3">
              {user.uniformNumber ?? "未設定"}
            </dd>
            <dt className="text-gray-500">メール</dt>
            <dd className="col-span-1 sm:col-span-3">{user.email}</dd>
          </dl>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">今後の予定</h2>
        <Link href="/schedule" className="text-sm text-emerald-600 hover:underline">
          すべて見る
        </Link>
      </div>
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        {upcomingEvents.length === 0 ? (
          <p className="text-sm text-gray-500">予定はありません。</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcomingEvents.map((ev) => (
              <li key={ev.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-gray-900">{ev.title}</p>
                  <p className="text-sm text-gray-500">
                    {ev.startAt.toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {ev.location && ` ・ ${ev.location}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                  {ev.responses[0] ? STATUS_LABELS[ev.responses[0].status] : "未回答"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">メッセージ</h2>
        <Link href="/messages" className="text-sm text-emerald-600 hover:underline">
          すべて見る
        </Link>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {channels.map((c) => (
          <Link
            key={c.id}
            href={`/messages/${c.id}`}
            className="rounded-xl border border-gray-200 bg-white p-5 hover:bg-gray-50"
          >
            <h3 className="font-semibold text-gray-900"># {c.name}</h3>
            <p className="mt-1 text-xs text-gray-400">{c._count.messages}件のメッセージ</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
