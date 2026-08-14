import { canRespondToEvent } from "@/lib/schedule-permissions";
import type { EventForList } from "@/components/EventList";
import type { AttendanceStatus, Category } from "@/generated/prisma/client";

// Shared between the schedule list page and the single-event detail page
// (opened from a calendar chip) so both build the exact same card shape.
export type EventWithRelationsForList = {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  startAt: Date;
  createdAt: Date;
  createdById: string;
  createdBy: { name: string };
  categories: { category: Category }[];
  responses: { userId: string; status: AttendanceStatus; user: { name: string } }[];
  matchResult: { id: string } | null;
};

export type UserForEligibility = {
  id: string;
  name: string;
  categories: { category: Category }[];
};

export function buildEventForList(
  ev: EventWithRelationsForList,
  allUsers: UserForEligibility[],
  ctx: {
    currentUserId: string;
    currentUserIsAdmin: boolean;
    userCategories: Category[];
    now: Date;
    lastScheduleVisitAt: Date | null;
  }
): EventForList {
  const eventCategories: Category[] = ev.categories.map((c) => c.category);
  const eligibleUsers = allUsers.filter((u) =>
    canRespondToEvent(u.categories.map((c) => c.category), eventCategories)
  );
  const counts = { attending: 0, matchOnly: 0, absent: 0, undecided: 0, noResponse: 0 };
  const attendingNames: string[] = [];
  const matchOnlyNames: string[] = [];
  const absentNames: string[] = [];
  const undecidedNames: string[] = [];
  const respondedIds = new Set<string>();
  for (const r of ev.responses) {
    respondedIds.add(r.userId);
    if (r.status === "ATTENDING") {
      counts.attending++;
      attendingNames.push(r.user.name);
    } else if (r.status === "MATCH_ONLY") {
      counts.matchOnly++;
      matchOnlyNames.push(r.user.name);
    } else if (r.status === "ABSENT") {
      counts.absent++;
      absentNames.push(r.user.name);
    } else {
      counts.undecided++;
      undecidedNames.push(r.user.name);
    }
  }
  const noResponseNames: string[] = [];
  for (const u of eligibleUsers) {
    if (!respondedIds.has(u.id)) {
      counts.noResponse++;
      noResponseNames.push(u.name);
    }
  }

  const myResponse: AttendanceStatus | null =
    ev.responses.find((r) => r.userId === ctx.currentUserId)?.status ?? null;

  return {
    id: ev.id,
    title: ev.title,
    location: ev.location,
    notes: ev.notes,
    startAt: ev.startAt.toISOString(),
    createdByName: ev.createdBy.name,
    categories: eventCategories,
    myResponse,
    canDelete: ctx.currentUserIsAdmin || ev.createdById === ctx.currentUserId,
    eligible: canRespondToEvent(ctx.userCategories, eventCategories),
    isPast: ev.startAt < ctx.now,
    isNew: !ctx.lastScheduleVisitAt || ev.createdAt > ctx.lastScheduleVisitAt,
    hasMatchResult: ev.matchResult !== null,
    counts,
    attendingNames,
    matchOnlyNames,
    absentNames,
    undecidedNames,
    noResponseNames,
  };
}
