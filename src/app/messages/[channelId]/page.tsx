import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canAccessChannel, ensureDefaultChannels } from "@/lib/channels";
import AppShell from "@/components/AppShell";
import MessageComposer from "@/components/MessageComposer";
import PollRefresh from "@/components/PollRefresh";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await ensureDefaultChannels();

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { categories: true },
  });
  if (!channel) notFound();
  if (!canAccessChannel(user, channel)) redirect("/messages");

  const recent = await prisma.message.findMany({
    where: { channelId },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const messages = recent.reverse();

  return (
    <AppShell user={user}>
      <PollRefresh intervalMs={4000} />
      <Link href="/messages" className="text-xs text-emerald-600 hover:underline">
        ← チャンネル一覧
      </Link>
      <h2 className="mt-1 text-lg font-bold text-gray-900"># {channel.name}</h2>
      {channel.description && (
        <p className="text-sm text-gray-500">{channel.description}</p>
      )}

      <div className="mt-4 flex h-[60vh] flex-col rounded-xl border border-gray-200 bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400">まだメッセージはありません。</p>
          )}
          {messages.map((m) => (
            <div key={m.id}>
              <p className="text-xs text-gray-400">
                {m.author.name}{" "}
                {m.createdAt.toLocaleString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{m.body}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-200 p-3">
          <MessageComposer channelId={channel.id} />
        </div>
      </div>
    </AppShell>
  );
}
