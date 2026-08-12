import { prisma } from "@/lib/prisma";
import type { Category } from "@/generated/prisma/client";

const DEFAULT_CHANNELS: { name: string; categories: Category[]; isGlobal?: boolean }[] = [
  { name: "トップ", categories: ["TOP_PLAYER", "TOP_COACH"] },
  { name: "サテライト", categories: ["SATELLITE_PLAYER", "SATELLITE_COACH"] },
  { name: "U18", categories: ["U18_PLAYER", "U18_COACH"] },
  { name: "全体", categories: [], isGlobal: true },
];

export async function ensureDefaultChannels() {
  const existing = await prisma.channel.findMany({
    where: { isDefault: true },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((c) => c.name));

  for (const def of DEFAULT_CHANNELS) {
    if (existingNames.has(def.name)) continue;
    await prisma.channel.create({
      data: {
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
