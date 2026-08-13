import { prisma } from "@/lib/prisma";
import type { Category } from "@/generated/prisma/client";

const DEFAULT_CHANNELS: { name: string; categories: Category[]; isGlobal?: boolean }[] = [
  { name: "トップ", categories: ["TOP_PLAYER", "TOP_COACH"] },
  { name: "サテライト", categories: ["SATELLITE_PLAYER", "SATELLITE_COACH"] },
  { name: "U18", categories: ["U18_PLAYER", "U18_COACH"] },
  { name: "全体", categories: [], isGlobal: true },
];

export async function ensureDefaultChannels() {
  // This runs on every page load across several pages - including every
  // poll on the messages page (every few seconds while a channel is open)
  // - so the common case (defaults already exist) needs to be cheap: one
  // count query instead of 4 upsert writes on every single request.
  const existingCount = await prisma.channel.count({ where: { isDefault: true } });
  if (existingCount >= DEFAULT_CHANNELS.length) return;

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

export function canAccessChannel(
  user: { id: string; isAdmin: boolean; categories: { category: Category }[] },
  channel: { isGlobal: boolean; createdById: string | null; categories: { category: Category }[] }
): boolean {
  if (user.isAdmin) return true;
  if (channel.isGlobal) return true;
  if (channel.createdById === user.id) return true;
  const userCategories = new Set(user.categories.map((c) => c.category));
  return channel.categories.some((c) => userCategories.has(c.category));
}
