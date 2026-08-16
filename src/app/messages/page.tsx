import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canAccessChannel, ensureDefaultChannels } from "@/lib/channels";
import { getUnreadChannelIds } from "@/lib/unread";
import { isViewOnly } from "@/lib/categories";
import AppShell from "@/components/AppShell";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isViewOnly(user.categories.map((c) => c.category))) redirect("/schedule");

  await ensureDefaultChannels();

  const [channels, unreadChannelIds] = await Promise.all([
    prisma.channel.findMany({
      include: { categories: true, _count: { select: { messages: true } } },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    getUnreadChannelIds(user),
  ]);

  const accessible = channels.filter((c) => canAccessChannel(user, c));

  return (
    <AppShell user={user}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">メッセージ</h2>
        <Link
          href="/messages/new"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800"
        >
          チャンネルを追加
        </Link>
      </div>

      <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {accessible.map((c) => (
          <Link
            key={c.id}
            href={`/messages/${c.id}`}
            className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900"># {c.name}</p>
                {unreadChannelIds.has(c.id) && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                    NEW
                  </span>
                )}
              </div>
              {c.description && <p className="text-sm text-gray-500">{c.description}</p>}
            </div>
            <span className="text-xs text-gray-400">{c._count.messages}件</span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
