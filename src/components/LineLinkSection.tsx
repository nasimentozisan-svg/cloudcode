"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateLineLinkCodeAction, unlinkLineAction } from "@/lib/actions/line";

export default function LineLinkSection({
  linked,
  initialCode,
  lineAddFriendUrl,
}: {
  linked: boolean;
  initialCode: string | null;
  lineAddFriendUrl: string | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generateCode() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateLineLinkCodeAction();
        setCode(result.code);
      } catch (e) {
        setError(e instanceof Error ? e.message : "コードの発行に失敗しました");
      }
    });
  }

  function unlink() {
    if (!confirm("LINE連携を解除しますか？")) return;
    setError(null);
    startTransition(async () => {
      try {
        await unlinkLineAction();
        setCode(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "解除に失敗しました");
      }
    });
  }

  if (linked) {
    return (
      <div>
        <p className="text-sm text-emerald-700">LINE連携済み・通知が届きます</p>
        <button
          type="button"
          onClick={unlink}
          disabled={isPending}
          className="mt-1 text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          連携を解除する
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {!code ? (
        <button
          type="button"
          onClick={generateCode}
          disabled={isPending}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          連携コードを発行する
        </button>
      ) : (
        <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          <p>
            1.{" "}
            {lineAddFriendUrl ? (
              <a href={lineAddFriendUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">
                EFKのLINE公式アカウントを友だち追加
              </a>
            ) : (
              "EFKのLINE公式アカウントを友だち追加"
            )}
          </p>
          <p className="mt-1">2. トークでこのコードを送信</p>
          <p className="mt-1 font-mono text-lg font-bold tracking-widest text-gray-900">{code}</p>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
