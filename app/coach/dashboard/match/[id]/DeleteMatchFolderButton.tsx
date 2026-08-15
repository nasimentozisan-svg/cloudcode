"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteMatchFolderButton({
  folderId,
}: {
  folderId: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        "このフォルダと中の動画をすべて削除しますか？元に戻せません。"
      )
    )
      return;

    setDeleting(true);
    const res = await fetch(`/api/match-folders/${folderId}`, {
      method: "DELETE",
    });
    setDeleting(false);

    if (!res.ok) {
      window.alert("削除に失敗しました");
      return;
    }

    router.push("/coach/dashboard/match");
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {deleting ? "削除中..." : "フォルダを削除"}
    </button>
  );
}
