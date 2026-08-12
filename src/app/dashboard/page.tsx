import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import { formatCategories } from "@/lib/categories";
import { canAccessChannel, ensureDefaultChannels } from "@/lib/channels";
import { EXTERNAL_APPS } from "@/lib/external-apps";
import SizeEditForm from "@/components/SizeEditForm";
import EmailNotificationToggle from "@/components/EmailNotificationToggle";
import CalendarSyncSection from "@/components/CalendarSyncSection";
import { calculateAttendanceRate } from "@/lib/attendance";

const STATUS_LABELS: Record<string, string> = {
  ATTENDING: "出席",
  ABSENT: "欠席",
  UNDECIDED: "未定",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userCategories = user.categories.map((c) => c.category);
  const now = new Date();
  const [upcomingEvents, pastEvents] = await Promise.all([
    prisma.event.findMany({
      where: {
        startAt: { gte: now },
        ...(user.isAdmin
          ? {}
          : { categories: { some: { category: { in: userCategories } } } }),
      },
      include: { responses: { where: { userId: user.id } } },
      orderBy: { startAt: "asc" },
      take: 3,
    }),
    prisma.event.findMany({
      where: { startAt: { lt: now } },
      include: { categories: true, responses: true },
    }),
  ]);
  const attendanceRate = calculateAttendanceRate(user.id, userCategories, pastEvents);

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
            <dt className="text-gray-500">出席率</dt>
            <dd className="col-span-1 sm:col-span-3">
              {attendanceRate.rate !== null
                ? `${attendanceRate.rate}%（${attendanceRate.attended}/${attendanceRate.eligible}）`
                : "対象の過去の予定がありません"}
            </dd>
          </dl>

          <h3 className="mt-6 text-sm font-semibold text-gray-500">
            ウェアサイズ（大人男性用）
          </h3>
          <div className="mt-2">
            <SizeEditForm
              shirtSize={user.shirtSize}
              pantsSize={user.pantsSize}
              jerseySize={user.jerseySize}
            />
          </div>

          <div className="mt-6">
            <EmailNotificationToggle initialValue={user.receiveEmailNotifications} />
          </div>
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

      {user.isAdmin && (
        <>
          <h2 className="mt-8 text-lg font-bold text-gray-900">Googleカレンダー</h2>
          <div className="mt-4">
            <CalendarSyncSection initialToken={user.calendarToken} />
          </div>
        </>
      )}

      <h2 className="mt-8 text-lg font-bold text-gray-900">EFKアプリ</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {EXTERNAL_APPS.map((app) => (
          <a
            key={app.name}
            href={app.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50"
          >
            <Image
              src={app.icon}
              alt={app.name}
              width={48}
              height={48}
              className="shrink-0 rounded-full"
            />
            <div>
              <h3 className="font-semibold text-gray-900">{app.name}</h3>
              <p className="text-xs text-gray-500">{app.description}</p>
            </div>
          </a>
        ))}
      </div>
    </AppShell>
  );
}
