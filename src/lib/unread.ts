import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { canAccessChannel } from "@/lib/channels";
import type { User, UserCategory } from "@/generated/prisma/client";

// Returns the ids of every channel the user can see that has a message
// posted after their last visit (or that they've never visited at all).
//
// Wrapped in React's cache() because AppShell (rendered on every page, for
// the nav badge) and several pages that also need the channel list both
// call this with the same `user` object within one request - without the
// wrapper each call re-runs its own Channel + ChannelRead queries, tripling
// the same work on pages like /dashboard and /messages.
export const getUnreadChannelIds = cache(async function getUnreadChannelIds(
  user: User & { categories: UserCategory[] }
): Promise<Set<string>> {
  const [channels, reads] = await Promise.all([
    prisma.channel.findMany({
      include: {
        categories: true,
        members: { select: { userId: true } },
        leaves: { select: { userId: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
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
});

// Ids of events the user has individually opened (via a calendar chip or
// the event detail page). An event not in this set is "new" to this user -
// merely viewing the schedule list/calendar does NOT mark events read,
// only opening the specific event's own card does.
//
// Also cache()'d: /dashboard calls this directly and it's cheap insurance
// against future callers duplicating it within the same request.
export const getReadEventIds = cache(async function getReadEventIds(
  userId: string
): Promise<Set<string>> {
  const reads = await prisma.eventRead.findMany({
    where: { userId },
    select: { eventId: true },
  });
  return new Set(reads.map((r) => r.eventId));
});
