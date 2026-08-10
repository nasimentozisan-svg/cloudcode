"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteVideoButton({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!window.confirm("この動画を削除しますか？元に戻せません。")) return;

    setDeleting(true);
    const res = await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
    setDeleting(false);

    if (!res.ok) {
      window.alert("削除に失敗しました");
      return;
    }

    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="shrink-0 text-sm text-red-600 underline disabled:opacity-50"
    >
      {deleting ? "削除中..." : "削除"}
    </button>
  );
}
