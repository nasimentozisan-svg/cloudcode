"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postMessageAction } from "@/lib/actions/messages";
import { MENTION_ALL, activeMentionQuery, type MentionableMember } from "@/lib/mentions";

export default function MessageComposer({
  channelId,
  members,
}: {
  channelId: string;
  members: MentionableMember[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const candidates = mention
    ? [{ id: "__all__", name: MENTION_ALL }, ...members]
        .filter((m) => m.name.includes(mention.query))
        .slice(0, 8)
    : [];

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setBody(value);
    const caret = e.target.selectionStart ?? value.length;
    setMention(activeMentionQuery(value, caret));
  }

  function insertMention(name: string) {
    if (!mention || !textareaRef.current) return;
    const caret = textareaRef.current.selectionStart ?? body.length;
    const before = body.slice(0, mention.start);
    const after = body.slice(caret);
    const inserted = `@${name} `;
    const next = `${before}${inserted}${after}`;
    setBody(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = before.length + inserted.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handleSubmit() {
    if (body.trim().length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await postMessageAction(channelId, body);
        setBody("");
        setMention(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "送信に失敗しました");
      }
    });
  }

  return (
    <div>
      <p className="mb-1 text-xs text-gray-400">
        「@」で相手を指定するとメールで通知されます（「@{MENTION_ALL}」でチャンネル全員に通知。何も指定しなければメール通知なし）
      </p>
      <div className="relative flex items-end gap-2">
        {mention && candidates.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => insertMention(c.name)}
                className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                @{c.name}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !mention) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={2}
          placeholder="メッセージを入力（@で通知したい相手を指定）"
          className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          送信
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
