"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postMessageAction } from "@/lib/actions/messages";

export default function MessageComposer({ channelId }: { channelId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const body = (formData.get("body") as string) ?? "";
    setError(null);
    startTransition(async () => {
      try {
        await postMessageAction(channelId, body);
        formRef.current?.reset();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "送信に失敗しました");
      }
    });
  }

  return (
    <div>
      <form ref={formRef} action={handleSubmit} className="flex items-end gap-2">
        <textarea
          name="body"
          rows={2}
          required
          placeholder="メッセージを入力"
          className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          送信
        </button>
      </form>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
