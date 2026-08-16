"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseScheduleText, type ParsedScheduleLine } from "@/lib/schedule-import";
import { bulkCreateEventsAction } from "@/lib/actions/schedule";
import { CATEGORY_LABELS, CATEGORY_OPTIONS } from "@/lib/categories";
import type { Category } from "@/generated/prisma/client";

const EXAMPLE = `2026-08-20 15:00,対〇〇FC,市営体育館\n2026-08-27 10:00,対△△SC,県立アリーナ`;

export default function ScheduleImportForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedScheduleLine[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = CATEGORY_OPTIONS.filter(
    (c) => c !== "GUARDIAN" && c !== "SUPPORTER"
  );
  const hasErrors = parsed?.some((p) => p.error !== null) ?? false;
  const validCount = parsed?.filter((p) => p.error === null).length ?? 0;

  function toggleCategory(c: Category) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function handlePreview() {
    setError(null);
    setParsed(parseScheduleText(text));
  }

  function handleSubmit() {
    if (!parsed) return;
    if (categories.length === 0) {
      setError("対象カテゴリーを1つ以上選択してください");
      return;
    }
    setError(null);
    const validRows = parsed.filter((p) => p.error === null);
    startTransition(async () => {
      const result = await bulkCreateEventsAction(
        validRows.map((p) => ({
          title: p.title as string,
          startAt: (p.startAt as Date).toISOString(),
          location: p.location,
        })),
        categories
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/schedule");
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">
        <p className="font-medium text-gray-700">貼り付ける形式（1行1件）</p>
        <p className="mt-1">日付 時刻,タイトル,場所（場所は省略可）</p>
        <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-2 text-gray-500">{EXAMPLE}</pre>
        <p className="mt-2">
          試合日程表の画像やPDFをClaude
          Codeなどのチャットに見せて、「この形式に変換して」と頼むと、この欄に貼り付けられる形式にしてもらえます。
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">貼り付け欄</label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setParsed(null);
          }}
          rows={8}
          placeholder={EXAMPLE}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
        />
        <button
          type="button"
          onClick={handlePreview}
          disabled={text.trim().length === 0}
          className="mt-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          プレビュー
        </button>
      </div>

      {parsed && (
        <div>
          <p className="text-sm font-medium text-gray-700">
            プレビュー（{validCount}/{parsed.length}件を読み取れました）
          </p>
          <div className="mt-2 overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-3 py-2">行</th>
                  <th className="px-3 py-2">内容</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsed.map((p) => (
                  <tr key={p.lineNumber} className={p.error ? "bg-red-50" : ""}>
                    <td className="px-3 py-2 text-gray-400">{p.lineNumber}</td>
                    <td className="px-3 py-2">
                      {p.error !== null ? (
                        <span className="text-red-600">
                          {p.raw} — {p.error}
                        </span>
                      ) : (
                        <span className="text-gray-700">
                          {p.title} ・{" "}
                          {p.startAt.toLocaleString("ja-JP", {
                            month: "numeric",
                            day: "numeric",
                            weekday: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {p.location && ` ・ ${p.location}`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasErrors && (
            <p className="mt-2 text-xs text-red-600">
              赤い行は形式エラーのため登録されません。貼り付け欄を修正して再度プレビューしてください。
            </p>
          )}
        </div>
      )}

      {parsed && validCount > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            対象カテゴリー（このバッチ全ての予定に適用・複数選択可）
          </label>
          <div className="mt-1 grid grid-cols-2 gap-2 rounded-md border border-gray-300 p-3 sm:grid-cols-3">
            {categoryOptions.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={categories.includes(c)}
                  onChange={() => toggleCategory(c)}
                />
                {CATEGORY_LABELS[c]}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {parsed && validCount > 0 && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? "登録中..." : `${validCount}件を登録する`}
        </button>
      )}
    </div>
  );
}
