"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleReactionAction } from "@/lib/actions/messages";
import { REACTION_EMOJIS } from "@/lib/reactions";

export default function MessageReactions({
  messageId,
  reactions,
  currentUserId,
}: {
  messageId: string;
  reactions: { emoji: string; userId: string; user: { name: string } }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const summary = REACTION_EMOJIS.map((emoji) => {
    const forEmoji = reactions.filter((r) => r.emoji === emoji);
    return {
      emoji,
      count: forEmoji.length,
      mine: forEmoji.some((r) => r.userId === currentUserId),
      names: forEmoji.map((r) => r.user.name),
    };
  }).filter((r) => r.count > 0);

  function toggle(emoji: string) {
    setPickerOpen(false);
    startTransition(async () => {
      await toggleReactionAction(messageId, emoji);
      router.refresh();
    });
  }

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-1">
        {summary.map((r) => (
          <button
            key={r.emoji}
            type="button"
            disabled={isPending}
            onClick={() => toggle(r.emoji)}
            title={r.names.join("、")}
            className={`rounded-full border px-1.5 py-0.5 text-xs disabled:opacity-50 ${
              r.mine
                ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {r.emoji} {r.count}
          </button>
        ))}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-full border border-gray-200 px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-50"
            aria-label="リアクションを追加"
          >
            +
          </button>
          {pickerOpen && (
            <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-0.5 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={isPending}
                  onClick={() => toggle(emoji)}
                  className="rounded px-1.5 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {summary.length > 0 && (
        <p className="mt-0.5 text-[11px] leading-tight text-gray-400">
          {summary.map((r) => `${r.emoji} ${r.names.join("・")}`).join("　")}
        </p>
      )}
    </div>
  );
}
