import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Category } from "@/generated/prisma/client";

const DEFAULT_CHANNELS: { name: string; categories: Category[]; isGlobal?: boolean }[] = [
  { name: "トップ", categories: ["TOP_PLAYER", "TOP_COACH"] },
  { name: "サテライト", categories: ["SATELLITE_PLAYER", "SATELLITE_COACH"] },
  { name: "U18", categories: ["U18_PLAYER", "U18_COACH"] },
  { name: "全体", categories: [], isGlobal: true },
];

// Default channels can't be deleted or left (see actions/messages.ts), so
// once this server instance has seen them all exist it never needs to ask
// the DB again - saves a sequential round trip on every page load.
let defaultChannelsConfirmed = false;

export async function ensureDefaultChannels() {
  if (defaultChannelsConfirmed) return;
  // This runs on every page load across several pages - including every
  // poll on the messages page (every few seconds while a channel is open)
  // - so the common case (defaults already exist) needs to be cheap: one
  // count query instead of 4 upsert writes on every single request.
  const existingCount = await prisma.channel.count({ where: { isDefault: true } });
  if (existingCount >= DEFAULT_CHANNELS.length) {
    defaultChannelsConfirmed = true;
    return;
  }

  // This runs on every page load across several pages, so concurrent
  // requests are expected (e.g. two tabs open right after a fresh deploy).
  // upsert-by-name relies on Channel.name being unique to insert
  // atomically instead of a check-then-create that can race and duplicate.
  for (const def of DEFAULT_CHANNELS) {
    await prisma.channel.upsert({
      where: { name: def.name },
      update: {},
      create: {
        name: def.name,
        isDefault: true,
        isGlobal: !!def.isGlobal,
        categories: { create: def.categories.map((category) => ({ category })) },
      },
    });
  }
}

// Every channel with what access checks and the channel list need. cache()'d
// so a page's own channel list and AppShell's unread badge share one query
// per request instead of each running its own (which also left one of the
// page's parallel queries queued behind the small connection pool).
export const getAllChannels = cache(() =>
  prisma.channel.findMany({
    include: {
      categories: true,
      members: { select: { userId: true } },
      leaves: { select: { userId: true } },
      _count: { select: { messages: true } },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  })
);

export function canAccessChannel(
  user: { id: string; isAdmin: boolean; categories: { category: Category }[] },
  channel: {
    isGlobal: boolean;
    createdById: string | null;
    categories: { category: Category }[];
    members: { userId: string }[];
    leaves: { userId: string }[];
  }
): boolean {
  if (user.isAdmin) return true;
  if (channel.createdById === user.id) return true;
  // An individual invite always grants access (so re-inviting someone who
  // left works), checked before the leave record so it takes priority.
  if (channel.members.some((m) => m.userId === user.id)) return true;
  if (channel.leaves.some((l) => l.userId === user.id)) return false;
  if (channel.isGlobal) return true;
  const userCategories = new Set(user.categories.map((c) => c.category));
  return channel.categories.some((c) => userCategories.has(c.category));
}
