"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { postMessageAction } from "@/lib/actions/messages";
import { MENTION_ALL, activeMentionQuery, type MentionableMember } from "@/lib/mentions";
import { MAX_ATTACHMENT_SIZE } from "@/lib/attachments";

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
  const [file, setFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const candidates = mention
    ? [{ id: "__all__", name: MENTION_ALL }, ...members]
        .filter((m) => m.name.includes(mention.query))
        .slice(0, mention.query.length > 0 ? 8 : 30)
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

  // Lets people tap straight to a name without typing "@" first - handy on
  // mobile where switching to the symbol keyboard is its own hassle.
  function openMentionMenu() {
    if (mention) {
      setMention(null);
      return;
    }
    const caret = textareaRef.current?.selectionStart ?? body.length;
    setMention({ query: "", start: caret });
  }

  function toggleBold() {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const selected = body.slice(start, end);
    const next = `${body.slice(0, start)}**${selected}**${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      if (selected.length > 0) {
        el.setSelectionRange(start + 2, end + 2);
      } else {
        el.setSelectionRange(start + 2, start + 2);
      }
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.size > MAX_ATTACHMENT_SIZE) {
      setError("添付ファイルは10MBまでです");
      e.target.value = "";
      return;
    }
    setError(null);
    setFile(selected);
  }

  function removeFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit() {
    if (body.trim().length === 0 && !file) return;
    setError(null);
    startTransition(async () => {
      try {
        let attachment: { url: string; name: string } | null = null;
        if (file) {
          const blob = await upload(file.name, file, {
            access: "public",
            handleUploadUrl: "/api/upload",
            clientPayload: "attachment",
          });
          attachment = { url: blob.url, name: file.name };
        }
        await postMessageAction(channelId, body, attachment);
        setBody("");
        setMention(null);
        removeFile();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "送信に失敗しました");
      }
    });
  }

  return (
    <div>
      <p className="mb-1 text-xs text-gray-400">
        「@」ボタンまたは入力欄で「@」を押して相手を指定すると通知が届きます（「@{MENTION_ALL}」で全員に通知。何も指定しなければ通知なし）
        ／添付ファイルは10MBまで、15日間保存されます
      </p>
      {file && (
        <div className="mb-1 flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600">
          <span>📎 {file.name}</span>
          <button
            type="button"
            onClick={removeFile}
            className="text-gray-400 hover:text-gray-600"
            aria-label="添付を取り消す"
          >
            ×
          </button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={handleChange}
        rows={3}
        placeholder="メッセージを入力（@で通知したい相手を指定）"
        className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="relative mt-2 flex items-center gap-2">
        {mention && candidates.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 max-h-56 w-56 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
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
        <button
          type="button"
          onClick={openMentionMenu}
          className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium ${
            mention
              ? "border-emerald-600 bg-emerald-50 text-emerald-700"
              : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
          aria-label="メンションを挿入"
        >
          @
        </button>
        <button
          type="button"
          onClick={toggleBold}
          className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50"
          aria-label="太字"
        >
          B
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          aria-label="ファイルを添付"
        >
          📎
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="ml-auto shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          送信
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
