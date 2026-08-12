import type { User, UserCategory } from "@/generated/prisma/client";

export function canManageSchedule(user: User & { categories: UserCategory[] }): boolean {
  if (user.isAdmin) return true;
  return user.categories.some((c) => c.category.endsWith("_COACH"));
}
