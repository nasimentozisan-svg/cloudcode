"use client";

import { useState, useTransition } from "react";
import { generateCalendarTokenAction, resetCalendarTokenAction } from "@/lib/actions/calendar";

export default function CalendarSyncSection({
  initialToken,
}: {
  initialToken: string | null;
}) {
  const [token, setToken] = useState(initialToken);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const url =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/api/calendar/${token}`
      : null;

  function copyUrl() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="font-semibold text-gray-900">Googleカレンダー連携</h3>
      <p className="mt-1 text-sm text-gray-500">
        クラブの予定をGoogleカレンダーに購読（同期）できます。管理者だけが使える機能です。反映には数十分〜1時間ほどかかることがあります。
      </p>

      {!url ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const t = await generateCalendarTokenAction();
              setToken(t);
            })
          }
          className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          購読用URLを発行する
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700"
            />
            <button
              type="button"
              onClick={copyUrl}
              className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              {copied ? "コピーしました" : "URLをコピー"}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Googleカレンダーで「他のカレンダー」の「＋」→「URLで追加」からこのURLを貼り付けてください。
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirm("URLを再発行しますか？古いURLは使えなくなります。")) return;
              startTransition(async () => {
                const t = await resetCalendarTokenAction();
                setToken(t);
              });
            }}
            className="text-xs text-red-600 hover:underline disabled:opacity-40"
          >
            URLを再発行する（古いURLを無効化）
          </button>
        </div>
      )}
    </div>
  );
}
