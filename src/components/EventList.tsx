"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToEventAction, deleteEventAction } from "@/lib/actions/schedule";
import { CATEGORY_LABELS, CATEGORY_GROUP_COLORS, categoryGroups } from "@/lib/categories";
import type { AttendanceStatus, Category } from "@/generated/prisma/client";

export type EventForList = {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  startAt: string;
  createdByName: string;
  categories: Category[];
  myResponse: AttendanceStatus | null;
  canDelete: boolean;
  eligible: boolean;
  isPast: boolean;
  counts: {
    attending: number;
    absent: number;
    undecided: number;
    noResponse: number;
  };
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  ATTENDING: "出席",
  ABSENT: "欠席",
  UNDECIDED: "未定",
};

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  ATTENDING: "bg-emerald-600 text-white",
  ABSENT: "bg-red-600 text-white",
  UNDECIDED: "bg-gray-400 text-white",
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EventList({ events }: { events: EventForList[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作に失敗しました");
      }
    });
  }

  if (events.length === 0) {
    return <p className="text-sm text-gray-500">予定はありません。</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {events.map((ev) => {
        const needsResponse = ev.eligible && !ev.isPast && ev.myResponse === null;
        return (
          <div
            key={ev.id}
            className={`rounded-xl border bg-white p-5 shadow-sm ${
              needsResponse ? "border-amber-300" : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{ev.title}</h3>
                  {ev.eligible && !ev.isPast && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        needsResponse
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {needsResponse ? "未回答" : "回答済み"}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-600">{formatDateTime(ev.startAt)}</p>
                {ev.location && <p className="text-sm text-gray-500">場所: {ev.location}</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {categoryGroups(ev.categories).map((g) => {
                    const color = CATEGORY_GROUP_COLORS[g];
                    return (
                      <span
                        key={g}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${color.chipBg} ${color.chipText}`}
                      >
                        {ev.categories
                          .filter((c) => c.startsWith(g))
                          .map((c) => CATEGORY_LABELS[c])
                          .join("・")}
                      </span>
                    );
                  })}
                </div>
                {ev.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{ev.notes}</p>
                )}
                {!ev.eligible && (
                  <p className="mt-2 text-xs text-gray-400">
                    ※自分のカテゴリー対象ではありません（閲覧のみ）
                  </p>
                )}
              </div>
              {ev.canDelete && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    run(async () => {
                      if (confirm(`「${ev.title}」を削除しますか？`)) {
                        await deleteEventAction(ev.id);
                      }
                    })
                  }
                  className="shrink-0 text-xs text-red-600 hover:underline disabled:opacity-40"
                >
                  削除
                </button>
              )}
            </div>

            {ev.eligible && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {(["ATTENDING", "ABSENT", "UNDECIDED"] as AttendanceStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => respondToEventAction(ev.id, status))}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${
                      ev.myResponse === status
                        ? STATUS_STYLES[status]
                        : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            )}

            <p className="mt-3 text-xs text-gray-400">
              出席 {ev.counts.attending} / 欠席 {ev.counts.absent} / 未定 {ev.counts.undecided} / 未回答{" "}
              {ev.counts.noResponse}　（作成: {ev.createdByName}）
            </p>
          </div>
        );
      })}
    </div>
  );
}
