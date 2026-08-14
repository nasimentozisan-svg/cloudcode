import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { formatCategories } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { canAccessChannel } from "@/lib/channels";
import { canRespondToEvent } from "@/lib/schedule-permissions";
import NavLinks, { type NavItem } from "@/components/NavLinks";
import type { Category, User, UserCategory } from "@/generated/prisma/client";

async function hasUnansweredSchedule(userId: string, userCategories: Category[]): Promise<boolean> {
  const upcomingEvents = await prisma.event.findMany({
    where: { startAt: { gte: new Date() } },
    include: { categories: true, responses: { where: { userId } } },
  });
  return upcomingEvents.some(
    (ev) =>
      canRespondToEvent(userCategories, ev.categories.map((c) => c.category)) && ev.responses.length === 0
  );
}

async function hasUnreadMessages(user: User & { categories: UserCategory[] }): Promise<boolean> {
  const [channels, reads] = await Promise.all([
    prisma.channel.findMany({
      include: { categories: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.channelRead.findMany({ where: { userId: user.id } }),
  ]);
  const readMap = new Map(reads.map((r) => [r.channelId, r.lastReadAt]));
  return channels.some((c) => {
    if (!canAccessChannel(user, c)) return false;
    const latest = c.messages[0];
    if (!latest) return false;
    const lastRead = readMap.get(c.id);
    return !lastRead || latest.createdAt > lastRead;
  });
}

export default async function AppShell({
  user,
  children,
}: {
  user: User & { categories: UserCategory[] };
  children: React.ReactNode;
}) {
  const userCategories = user.categories.map((c) => c.category);
  const [scheduleBadge, messagesBadge] = await Promise.all([
    hasUnansweredSchedule(user.id, userCategories),
    hasUnreadMessages(user),
  ]);

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "ホーム" },
    { href: "/schedule", label: "スケジュール", hasBadge: scheduleBadge },
    { href: "/messages", label: "メッセージ", hasBadge: messagesBadge },
    ...(user.isAdmin
      ? [
          { href: "/admin", label: "管理者" },
          { href: "/admin/cards", label: "選手証" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/dashboard" className="flex items-center gap-2 whitespace-nowrap">
              <Image
                src="/logo.png"
                alt="EFK members"
                width={40}
                height={40}
                className="rounded-full"
              />
              <span className="font-bold text-gray-900">EFK members</span>
            </Link>
            <NavLinks items={navItems} />
          </div>
          <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-gray-600">
            <span className="whitespace-nowrap">
              {user.name}（{formatCategories(user.categories.map((c) => c.category))}
              {user.isAdmin ? " / 管理者" : ""}）
            </span>
            <form action={logoutAction}>
              <button className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100">
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
