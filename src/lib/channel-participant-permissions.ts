import { isViewOnly } from "@/lib/categories";
import type { Category } from "@/generated/prisma/client";

export function canAddChannelParticipants(
  user: { id: string; isAdmin: boolean; categories: { category: Category }[] },
  channel: { isDefault: boolean; createdById: string | null }
): boolean {
  return !channel.isDefault &&
    !isViewOnly(user.categories.map(c => c.category)) &&
    (user.isAdmin || channel.createdById === user.id);
}
