import { prisma } from "@/lib/prisma";
import { canAccessChannel } from "@/lib/channels";
import type { User, UserCategory } from "@/generated/prisma/client";

// Returns the ids of every channel the user can see that has a message
// posted after their last visit (or that they've never visited at all).
export async function getUnreadChannelIds(
  user: User & { categories: UserCategory[] }
): Promise<Set<string>> {
  const [channels, reads] = await Promise.all([
    prisma.channel.findMany({
      include: { categories: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.channelRead.findMany({ where: { userId: user.id } }),
  ]);
  const readMap = new Map(reads.map((r) => [r.channelId, r.lastReadAt]));

  const unread = new Set<string>();
  for (const c of channels) {
    if (!canAccessChannel(user, c)) continue;
    const latest = c.messages[0];
    if (!latest) continue;
    const lastRead = readMap.get(c.id);
    if (!lastRead || latest.createdAt > lastRead) unread.add(c.id);
  }
  return unread;
}

// Ids of events the user has individually opened (via a calendar chip or
// the event detail page). An event not in this set is "new" to this user -
// merely viewing the schedule list/calendar does NOT mark events read,
// only opening the specific event's own card does.
export async function getReadEventIds(userId: string): Promise<Set<string>> {
  const reads = await prisma.eventRead.findMany({
    where: { userId },
    select: { eventId: true },
  });
  return new Set(reads.map((r) => r.eventId));
}
