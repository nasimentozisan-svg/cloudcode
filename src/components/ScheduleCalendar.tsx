"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORY_GROUP_COLORS, type CategoryGroup } from "@/lib/categories";

export type CalendarEvent = {
  id: string;
  title: string;
  day: number;
  groups: CategoryGroup[];
  needsResponse: boolean;
  isNew: boolean;
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function ScheduleCalendar({
  year,
  month,
  events,
  todayKey,
}: {
  year: number;
  month: number; // 1-12
  events: CalendarEvent[];
  todayKey: string; // "YYYY-MM-DD"
}) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstOfMonth.getDay();

  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const ev of events) {
    const list = eventsByDay.get(ev.day) ?? [];
    list.push(ev);
    eventsByDay.set(ev.day, list);
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonthDate = new Date(year, month - 2, 1);
  const nextMonthDate = new Date(year, month, 1);
  const prevHref = `/schedule?month=${prevMonthDate.getFullYear()}-${pad(prevMonthDate.getMonth() + 1)}`;
  const nextHref = `/schedule?month=${nextMonthDate.getFullYear()}-${pad(nextMonthDate.getMonth() + 1)}`;

  const router = useRouter();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const SWIPE_THRESHOLD = 50;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    router.push(dx < 0 ? nextHref : prevHref);
  }

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between">
        <Link
          href={prevHref}
          className="rounded-md px-3 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-100 active:bg-gray-200"
        >
          ← 前月
        </Link>
        <h3 className="text-base font-bold text-gray-900">
          {year}年{month}月
        </h3>
        <Link
          href={nextHref}
          className="rounded-md px-3 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-100 active:bg-gray-200"
        >
          翌月 →
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-px overflow-hidden rounded-md bg-gray-200 text-center text-xs font-medium text-gray-500">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="bg-gray-50 py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md bg-gray-200">
        {cells.map((day, i) => {
          const key = day ? `${year}-${pad(month)}-${pad(day)}` : `blank-${i}`;
          const isToday = day !== null && key === todayKey;
          const dayEvents = day ? (eventsByDay.get(day) ?? []) : [];
          const weekday = i % 7; // 0=Sun ... 6=Sat, matches WEEKDAY_LABELS order
          const numberColor = isToday
            ? "bg-emerald-600 font-bold text-white"
            : weekday === 0
              ? "text-red-500"
              : weekday === 6
                ? "text-blue-500"
                : "text-gray-600";
          return (
            <div key={key} className="min-h-[80px] bg-white p-1">
              {day !== null && (
                <>
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${numberColor}`}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const primaryColor = CATEGORY_GROUP_COLORS[ev.groups[0]];
                      return (
                        <Link
                          key={ev.id}
                          href={`/schedule/${ev.id}`}
                          title={ev.title}
                          className={`relative block truncate rounded px-1 py-0.5 text-[10px] leading-tight transition-opacity hover:opacity-75 active:opacity-50 ${primaryColor.chipBg} ${primaryColor.chipText} ${
                            ev.needsResponse ? "ring-1 ring-amber-500" : ""
                          }`}
                        >
                          {ev.isNew && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                          )}
                          {ev.groups.length > 1 && (
                            <span className="mr-0.5 inline-flex gap-0.5 align-middle">
                              {ev.groups.slice(1).map((g) => (
                                <span
                                  key={g}
                                  className={`inline-block h-1.5 w-1.5 rounded-full ${CATEGORY_GROUP_COLORS[g].dot}`}
                                />
                              ))}
                            </span>
                          )}
                          {ev.needsResponse && <span className="mr-0.5">●</span>}
                          {ev.title}
                        </Link>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-gray-400">+{dayEvents.length - 3}件</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        {(["TOP", "SATELLITE", "U18"] as CategoryGroup[]).map((g) => (
          <span key={g} className="flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${CATEGORY_GROUP_COLORS[g].dot}`} />
            {g === "TOP" ? "トップ" : g === "SATELLITE" ? "サテライト" : "U18"}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="text-amber-500">●</span>
          未回答
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          新着
        </span>
      </div>
    </div>
  );
}
