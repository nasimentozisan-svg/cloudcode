"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS, VIDEO_CATEGORIES, type VideoCategory } from "@/lib/categories";

export default function UploadForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<VideoCategory>("attack");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("動画ファイルを選択してください");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      setProgress("アップロード準備中...");
      const presignRes = await fetch("/api/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });

      if (!presignRes.ok) {
        throw new Error("アップロードURLの発行に失敗しました");
      }

      const { uploadUrl, key } = await presignRes.json();

      setProgress("動画をアップロード中...");
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error("動画のアップロードに失敗しました");
      }

      setProgress("保存中...");
      const { error: insertError } = await supabase.from("videos").insert({
        team_id: teamId,
        title,
        description: description || null,
        category,
        r2_key: key,
        status: "ready",
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setTitle("");
      setDescription("");
      setFile(null);
      (document.getElementById("video-file-input") as HTMLInputElement).value = "";
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
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 className="font-semibold">動画をアップロード</h2>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          タイトル
        </label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: サイドチェンジからの崩し"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          説明（任意）
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="ポイントや注意点を簡単に書いてください"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          フォルダ
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as VideoCategory)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
        >
          {VIDEO_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          動画ファイル
        </label>
        <input
          id="video-file-input"
          type="file"
          accept="video/*"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {progress && <p className="text-sm text-slate-500">{progress}</p>}

      <button
        type="submit"
        disabled={uploading}
        className="w-full rounded-md bg-slate-900 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {uploading ? "アップロード中..." : "アップロード"}
      </button>
    </form>
  );
}
