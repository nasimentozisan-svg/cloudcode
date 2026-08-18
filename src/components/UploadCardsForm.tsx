"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { processRosterUploadsAction, type UploadCardsState } from "@/lib/actions/cards";

export default function UploadCardsForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<UploadCardsState>({ matched: 0, pending: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const files = Array.from(fileInputRef.current?.files ?? []).filter((f) => f.size > 0);
    if (files.length === 0) {
      setState({ matched: 0, pending: 0, error: "PDFファイルを選択してください" });
      return;
    }

    startTransition(async () => {
      try {
        const uploads = await Promise.all(
          files.map(async (file) => {
            const blob = await upload(file.name, file, {
              access: "public",
              handleUploadUrl: "/api/upload",
              clientPayload: "roster",
            });
            return { url: blob.url, name: file.name };
          })
        );
        const result = await processRosterUploadsAction(uploads);
        setState(result);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } catch (err) {
        setState({
          matched: 0,
          pending: 0,
          error: err instanceof Error ? err.message : "アップロードに失敗しました",
        });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        required
        className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
      />
      <p className="text-xs text-gray-500">
        JFAの「登録選手一覧」PDF（トップ・サテライト・U18など、カテゴリーごと）をそのままアップロードできます。
        複数選択可。名簿に載っている名前・背番号・写真を読み取り、登録済みメンバーと自動で紐付けます。
        選手が増えたときは、更新した名簿PDFを同じようにアップロードし直せば反映されます。
      </p>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {!state.error && (state.matched > 0 || state.pending > 0) && (
        <p className="text-sm text-emerald-700">
          自動で紐付け: {state.matched}件 / 要確認: {state.pending}件
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {isPending ? "アップロード中..." : "アップロードして自動紐付け"}
      </button>
    </form>
  );
}
