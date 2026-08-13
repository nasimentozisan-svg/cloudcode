import type { Category, AttendanceStatus } from "@/generated/prisma/client";

export type AttendanceRate = {
  attended: number;
  eligible: number;
  rate: number | null; // percentage 0-100, null if no eligible past events
};

type EventForRate = {
  categories: { category: Category }[];
  responses: { userId: string; status: AttendanceStatus }[];
};

// Attendance rate = share of past events targeting one of the player's
// categories where they responded ATTENDING. Future events are excluded -
// an "出席" RSVP for something that hasn't happened yet isn't attendance.
export function calculateAttendanceRate(
  userId: string,
  userCategories: Category[],
  pastEvents: EventForRate[]
): AttendanceRate {
  const eligibleEvents = pastEvents.filter((ev) =>
    ev.categories.some(
      (c) => c.category !== "GUARDIAN" && userCategories.includes(c.category)
    )
  );
  const attended = eligibleEvents.filter((ev) =>
    ev.responses.some((r) => r.userId === userId && r.status === "ATTENDING")
  ).length;
  const eligible = eligibleEvents.length;

  return {
    attended,
    eligible,
    rate: eligible > 0 ? Math.round((attended / eligible) * 100) : null,
  };
}
