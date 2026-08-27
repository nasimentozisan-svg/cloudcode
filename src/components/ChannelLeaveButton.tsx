"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveChannelAction } from "@/lib/actions/messages";

export default function ChannelLeaveButton({
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
          if (!confirm(`「${channelName}」チャンネルから退出しますか？`)) return;
          setError(null);
          startTransition(async () => {
            try {
              await leaveChannelAction(channelId);
              router.push("/messages");
            } catch (e) {
              setError(e instanceof Error ? e.message : "退出に失敗しました");
            }
          });
        }}
        className="text-xs text-gray-500 hover:underline disabled:opacity-40"
      >
        このチャンネルから退出
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
