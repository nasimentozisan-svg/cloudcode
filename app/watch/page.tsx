"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "efktac-invite-code";

function subscribeNoop() {
  return () => {};
}

function getSavedCodeSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

export default function WatchEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const savedCode = useSyncExternalStore(
    subscribeNoop,
    getSavedCodeSnapshot,
    getServerSnapshot
  );

  function goToCode(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    window.localStorage.setItem(STORAGE_KEY, trimmed);
    router.push(`/watch/${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">戦術動画を見る</h1>
          <p className="mt-1 text-sm text-slate-500">
            コーチから伝えられた招待コードを入力してください
          </p>
        </div>

        {savedCode && (
          <button
            onClick={() => goToCode(savedCode)}
            className="w-full rounded-md border border-slate-300 bg-white py-2 text-sm font-medium hover:bg-slate-50"
          >
            前回のコード「{savedCode}」で続ける
          </button>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            goToCode(code);
          }}
          className="space-y-4"
        >
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="招待コード"
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 py-2 font-medium text-white hover:bg-slate-800"
          >
            見る
          </button>
        </form>
      </div>
    </div>
  );
}
