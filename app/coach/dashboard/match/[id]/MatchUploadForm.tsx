"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MatchUploadForm({
  matchFolderId,
  startSortOrder,
}: {
  matchFolderId: string;
  startSortOrder: number;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    setError(null);
    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`${i + 1}/${files.length} アップロード中...`);

        const presignRes = await fetch("/api/match-presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchFolderId,
            fileName: file.name,
            contentType: file.type,
          }),
        });
        if (!presignRes.ok) throw new Error("アップロードURLの発行に失敗しました");
        const { uploadUrl, key } = await presignRes.json();

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error(`${file.name}のアップロードに失敗しました`);

        const registerRes = await fetch("/api/match-videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchFolderId,
            r2Key: key,
            sortOrder: startSortOrder + i,
          }),
        });
        if (!registerRes.ok) throw new Error("保存に失敗しました");
      }

      setProgress(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
      setProgress(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold">動画を一括アップロード</h2>
      <input
        type="file"
        accept="video/*"
        multiple
        disabled={uploading}
        onChange={(e) => handleFiles(e.target.files)}
        className="w-full text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {progress && <p className="text-sm text-slate-500">{progress}</p>}
    </div>
  );
}
