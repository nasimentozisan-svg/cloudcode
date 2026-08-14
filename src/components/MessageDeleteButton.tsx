"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMessageAction } from "@/lib/actions/messages";

export default function MessageDeleteButton({ messageId }: { messageId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("このメッセージを取り消しますか？")) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteMessageAction(messageId);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "取り消しに失敗しました");
            }
          });
        }}
        className="text-gray-300 hover:text-red-600 hover:underline disabled:opacity-40"
      >
        取消
      </button>
      {error && <span className="ml-1 text-red-600">{error}</span>}
    </span>
  );
}
