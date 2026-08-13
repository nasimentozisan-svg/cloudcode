import type { Category, User, UserCategory } from "@/generated/prisma/client";

export function canManageSchedule(user: User & { categories: UserCategory[] }): boolean {
  if (user.isAdmin) return true;
  return user.categories.some((c) => c.category.endsWith("_COACH"));
}

// Guardians are view-only: even if an event happens to target GUARDIAN
// (e.g. a coach explicitly adds it), they should never see attendance
// response buttons for it.
export function canRespondToEvent(
  userCategories: Category[],
  eventCategories: Category[]
): boolean {
  return userCategories.some((c) => c !== "GUARDIAN" && eventCategories.includes(c));
}
