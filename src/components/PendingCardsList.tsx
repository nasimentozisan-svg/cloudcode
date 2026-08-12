"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignPendingCardAction, discardPendingCardAction } from "@/lib/actions/cards";

type PendingItem = {
  id: string;
  imageUrl: string;
  extractedText: string;
};

type UserOption = {
  id: string;
  name: string;
};

export default function PendingCardsList({
  items,
  users,
}: {
  items: PendingItem[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});

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

  if (items.length === 0) {
    return <p className="text-sm text-gray-500">要確認の画像はありません。</p>;
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt="要確認の選手証"
              width={160}
              height={200}
              className="mx-auto rounded-md object-cover"
            />
            <p className="mt-2 line-clamp-2 text-xs text-gray-500">
              読み取り結果: {item.extractedText || "（文字を読み取れませんでした）"}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <select
                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                value={selections[item.id] ?? ""}
                disabled={isPending}
                onChange={(e) =>
                  setSelections((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
              >
                <option value="" disabled>
                  選手を選択
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isPending || !selections[item.id]}
                onClick={() =>
                  run(() => assignPendingCardAction(item.id, selections[item.id]))
                }
                className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                紐付ける
              </button>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => discardPendingCardAction(item.id))}
              className="mt-2 text-xs text-red-600 hover:underline disabled:opacity-40"
            >
              この画像を破棄
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
