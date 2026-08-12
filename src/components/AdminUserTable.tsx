"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateUserCategoryAction,
  toggleAdminAction,
  deleteUserAction,
} from "@/lib/actions/admin";
import { CATEGORY_LABELS, CATEGORY_OPTIONS } from "@/lib/categories";
import type { User } from "@/generated/prisma/client";

export default function AdminUserTable({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作に失敗しました");
      }
    });
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">名前</th>
              <th className="px-4 py-2">背番号</th>
              <th className="px-4 py-2">カテゴリー</th>
              <th className="px-4 py-2">メール</th>
              <th className="px-4 py-2">管理者</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-2 text-gray-500">
                  {u.uniformNumber ?? "-"}
                </td>
                <td className="px-4 py-2">
                  <select
                    defaultValue={u.category}
                    disabled={isPending}
                    onChange={(e) =>
                      run(() => updateUserCategoryAction(u.id, e.target.value))
                    }
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-gray-500">{u.email}</td>
                <td className="px-4 py-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={u.isAdmin}
                      disabled={isPending || u.id === currentUserId}
                      onChange={(e) =>
                        run(() => toggleAdminAction(u.id, e.target.checked))
                      }
                    />
                    <span className="text-gray-500">管理者</span>
                  </label>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    disabled={isPending || u.id === currentUserId}
                    onClick={() =>
                      run(async () => {
                        if (confirm(`${u.name} を削除しますか？`)) {
                          await deleteUserAction(u.id);
                        }
                      })
                    }
                    className="text-xs text-red-600 hover:underline disabled:opacity-40"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
