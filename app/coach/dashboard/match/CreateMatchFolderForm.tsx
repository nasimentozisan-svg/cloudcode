"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEAM_CATEGORIES, TEAM_CATEGORY_LABELS, type TeamCategory } from "@/lib/categories";

export default function CreateMatchFolderForm() {
  const router = useRouter();
  const [teamCategory, setTeamCategory] = useState<TeamCategory>("top");
  const [opponent, setOpponent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/match-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamCategory, opponent }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("フォルダの作成に失敗しました");
      return;
    }

    const { id } = await res.json();
    router.push(`/coach/dashboard/match/${id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 className="font-semibold">新規フォルダ作成</h2>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          チーム区分
        </label>
        <select
          value={teamCategory}
          onChange={(e) => setTeamCategory(e.target.value as TeamCategory)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
        >
          {TEAM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {TEAM_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          対戦相手
        </label>
        <input
          required
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          placeholder="例: 〇〇FC"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-slate-900 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "作成中..." : "フォルダを作成"}
      </button>
    </form>
  );
}
