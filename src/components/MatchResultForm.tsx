"use client";

import { useState, useTransition } from "react";
import { saveMatchResultAction } from "@/lib/actions/match-result";
import { buildInstagramPost } from "@/lib/match-post";
import type { Category } from "@/generated/prisma/client";

type ScorerRow = { number: string; name: string; goals: string };

type Initial = {
  opponent: string;
  ourScore: number;
  opponentScore: number;
  scorers: { number: number | null; name: string; goals: number }[];
} | null;

function toRows(scorers: { number: number | null; name: string; goals: number }[]): ScorerRow[] {
  return scorers.map((s) => ({
    number: s.number !== null ? String(s.number) : "",
    name: s.name,
    goals: String(s.goals),
  }));
}

export default function MatchResultForm({
  eventId,
  eventTitle,
  eventCategories,
  startAt,
  initial,
}: {
  eventId: string;
  eventTitle: string;
  eventCategories: Category[];
  startAt: string;
  initial: Initial;
}) {
  const [opponent, setOpponent] = useState(initial?.opponent ?? "");
  const [ourScore, setOurScore] = useState(initial ? String(initial.ourScore) : "");
  const [opponentScore, setOpponentScore] = useState(initial ? String(initial.opponentScore) : "");
  const [scorers, setScorers] = useState<ScorerRow[]>(
    initial && initial.scorers.length > 0 ? toRows(initial.scorers) : [{ number: "", name: "", goals: "1" }]
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [postText, setPostText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function updateScorer(index: number, field: keyof ScorerRow, value: string) {
    setScorers((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function addScorer() {
    setScorers((prev) => [...prev, { number: "", name: "", goals: "1" }]);
  }

  function removeScorer(index: number) {
    setScorers((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    setError(null);
    setCopied(false);

    const ourScoreNum = Number(ourScore);
    const opponentScoreNum = Number(opponentScore);
    if (opponent.trim().length === 0) {
      setError("対戦相手を入力してください");
      return;
    }
    if (!Number.isInteger(ourScoreNum) || !Number.isInteger(opponentScoreNum)) {
      setError("スコアは数字で入力してください");
      return;
    }
    const validScorers = scorers.filter((s) => s.name.trim().length > 0);
    for (const s of validScorers) {
      if (!Number.isInteger(Number(s.goals)) || Number(s.goals) < 1) {
        setError("得点者の得点数は1以上の数字で入力してください");
        return;
      }
      if (s.number.trim().length > 0 && !Number.isInteger(Number(s.number))) {
        setError("背番号は数字で入力してください");
        return;
      }
    }

    startTransition(async () => {
      const result = await saveMatchResultAction(eventId, {
        opponent: opponent.trim(),
        ourScore: ourScoreNum,
        opponentScore: opponentScoreNum,
        scorers: validScorers.map((s) => ({
          number: s.number.trim().length > 0 ? Number(s.number) : undefined,
          name: s.name.trim(),
          goals: Number(s.goals),
        })),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      const text = buildInstagramPost({
        eventTitle,
        eventCategories,
        startAt: new Date(startAt),
        opponent: opponent.trim(),
        ourScore: ourScoreNum,
        opponentScore: opponentScoreNum,
        scorers: validScorers.map((s) => ({
          number: s.number.trim().length > 0 ? Number(s.number) : null,
          name: s.name.trim(),
          goals: Number(s.goals),
        })),
      });
      setPostText(text);
    });
  }

  async function handleCopy() {
    if (!postText) return;
    try {
      await navigator.clipboard.writeText(postText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("コピーに失敗しました。手動で選択してコピーしてください");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">対戦相手</label>
        <input
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="例: 熊本学園大学"
        />
      </div>

      <div className="flex items-center gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">自チーム</label>
          <input
            type="number"
            min={0}
            value={ourScore}
            onChange={(e) => setOurScore(e.target.value)}
            className="mt-1 w-20 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <span className="mt-6 text-gray-400">-</span>
        <div>
          <label className="block text-sm font-medium text-gray-700">相手</label>
          <input
            type="number"
            min={0}
            value={opponentScore}
            onChange={(e) => setOpponentScore(e.target.value)}
            className="mt-1 w-20 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">得点者</label>
        <div className="mt-1 space-y-2">
          {scorers.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={s.number}
                onChange={(e) => updateScorer(i, "number", e.target.value)}
                placeholder="背番号"
                className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                value={s.name}
                onChange={(e) => updateScorer(i, "name", e.target.value)}
                placeholder="名前"
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min={1}
                value={s.goals}
                onChange={(e) => updateScorer(i, "goals", e.target.value)}
                placeholder="得点数"
                className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => removeScorer(i)}
                className="shrink-0 text-xs text-red-600 hover:underline"
              >
                削除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addScorer}
          className="mt-2 text-xs text-emerald-700 hover:underline"
        >
          + 得点者を追加
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {isPending ? "保存中..." : "結果を保存して投稿文を作成"}
      </button>

      {postText && (
        <div>
          <p className="text-sm font-medium text-gray-700">Instagram投稿文</p>
          <pre className="mt-1 whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            {postText}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {copied ? "コピーしました！" : "コピーする"}
          </button>
        </div>
      )}
    </div>
  );
}
