"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteChannelAction } from "@/lib/actions/messages";

export default function ChannelDeleteButton({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm(`「${channelName}」チャンネルを削除しますか？投稿されたメッセージも全て削除されます。`)) {
            return;
          }
          setError(null);
          startTransition(async () => {
            try {
              await deleteChannelAction(channelId);
              router.push("/messages");
            } catch (e) {
              setError(e instanceof Error ? e.message : "削除に失敗しました");
            }
          });
        }}
        className="text-xs text-red-600 hover:underline disabled:opacity-40"
      >
        このチャンネルを削除
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
