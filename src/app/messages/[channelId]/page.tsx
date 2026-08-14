import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canAccessChannel, ensureDefaultChannels } from "@/lib/channels";
import AppShell from "@/components/AppShell";
import MessageComposer from "@/components/MessageComposer";
import MessageBody from "@/components/MessageBody";
import PollRefresh from "@/components/PollRefresh";
import ChannelDeleteButton from "@/components/ChannelDeleteButton";

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

  const [recent, allUsers] = await Promise.all([
    prisma.message.findMany({
      where: { channelId },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      select: { id: true, name: true, isAdmin: true, categories: { select: { category: true } } },
    }),
  ]);
  const messages = recent.reverse();
  const members = allUsers
    .filter((u) => canAccessChannel(u, channel))
    .map((u) => ({ id: u.id, name: u.name }));

  // Marks the channel read so the nav's unread dot clears - runs on every
  // visit (including the 8s poll refresh below) rather than tracking scroll
  // position, since "opened the channel" is a good enough proxy for "seen".
  await prisma.channelRead.upsert({
    where: { userId_channelId: { userId: user.id, channelId } },
    create: { userId: user.id, channelId },
    update: { lastReadAt: new Date() },
  });

  return (
    <AppShell user={user}>
      <PollRefresh intervalMs={8000} />
      <Link href="/messages" className="text-xs text-emerald-600 hover:underline active:text-emerald-800">
        ← チャンネル一覧
      </Link>
      <div className="mt-1 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900"># {channel.name}</h2>
        {!channel.isDefault && (user.isAdmin || channel.createdById === user.id) && (
          <ChannelDeleteButton channelId={channel.id} channelName={channel.name} />
        )}
      </div>
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
              <MessageBody body={m.body} members={members} />
            </div>
          ))}
        </div>
        <div className="border-t border-gray-200 p-3">
          <MessageComposer channelId={channel.id} members={members} />
        </div>
      </div>
    </AppShell>
  );
}
