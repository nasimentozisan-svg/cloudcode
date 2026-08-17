"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateUserCategoriesAction,
  toggleAdminAction,
  deleteUserAction,
} from "@/lib/actions/admin";
import { CATEGORY_LABELS, CATEGORY_OPTIONS, formatCategories } from "@/lib/categories";
import { UNIFORM_SIZE_LABELS } from "@/lib/uniform-sizes";
import type { AttendanceRate } from "@/lib/attendance";
import type { Category, User, UserCategory } from "@/generated/prisma/client";

type UserWithCategories = User & { categories: UserCategory[] };

export default function AdminUserTable({
  users,
  currentUserId,
  attendanceRates,
}: {
  users: UserWithCategories[];
  currentUserId: string;
  attendanceRates: Record<string, AttendanceRate>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<Category | "ALL">("ALL");

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

  const visibleUsers =
    filterCategory === "ALL"
      ? users
      : users.filter((u) => u.categories.some((c) => c.category === filterCategory));

  const categoryCounts = Object.fromEntries(
    CATEGORY_OPTIONS.map((c) => [
      c,
      users.filter((u) => u.categories.some((uc) => uc.category === c)).length,
    ])
  ) as Record<Category, number>;

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">カテゴリーで絞り込み:</span>
        <button
          type="button"
          onClick={() => setFilterCategory("ALL")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            filterCategory === "ALL"
              ? "bg-emerald-600 text-white"
              : "border border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          全員（{users.length}）
        </button>
        {CATEGORY_OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilterCategory(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filterCategory === c
                ? "bg-emerald-600 text-white"
                : "border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {CATEGORY_LABELS[c]}（{categoryCounts[c]}）
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">選手証</th>
              <th className="px-4 py-2">名前</th>
              <th className="px-4 py-2">背番号</th>
              <th className="px-4 py-2">ウェアサイズ（シャツ/パンツ/ジャージ）</th>
              <th className="px-4 py-2">出席率</th>
              <th className="px-4 py-2">カテゴリー</th>
              <th className="px-4 py-2">メール</th>
              <th className="px-4 py-2">管理者</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleUsers.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">
                  {u.cardImagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.cardImagePath}
                      alt={`${u.name}の選手証`}
                      width={32}
                      height={40}
                      className="rounded object-cover"
                    />
                  ) : (
                    <span className="text-xs text-gray-300">-</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-2 text-gray-500">
                  {u.uniformNumber ?? "-"}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                  {[u.shirtSize, u.pantsSize, u.jerseySize]
                    .map((s) => (s ? UNIFORM_SIZE_LABELS[s] : "-"))
                    .join(" / ")}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                  {attendanceRates[u.id]?.rate !== null && attendanceRates[u.id] !== undefined
                    ? `${attendanceRates[u.id].rate}%（${attendanceRates[u.id].attended}/${attendanceRates[u.id].eligible}）`
                    : "-"}
                </td>
                <td className="px-4 py-2">
                  {editingId === u.id ? (
                    <CategoryEditor
                      current={u.categories.map((c) => c.category)}
                      disabled={isPending}
                      onCancel={() => setEditingId(null)}
                      onSave={(next) =>
                        run(async () => {
                          await updateUserCategoriesAction(u.id, next);
                          setEditingId(null);
                        })
                      }
                    />
                  ) : (
                    <button
                      onClick={() => setEditingId(u.id)}
                      className="text-left text-gray-700 hover:underline"
                    >
                      {formatCategories(u.categories.map((c) => c.category)) || "未設定"}
                    </button>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-500">{u.email}</td>
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

function CategoryEditor({
  current,
  disabled,
  onSave,
  onCancel,
}: {
  current: Category[];
  disabled: boolean;
  onSave: (categories: string[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Category[]>(current);

  function toggle(c: Category) {
    setSelected((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  return (
    <div className="w-56 space-y-2 rounded-md border border-gray-300 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-1 gap-1">
        {CATEGORY_OPTIONS.map((c) => (
          <label key={c} className="flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={selected.includes(c)}
              onChange={() => toggle(c)}
            />
            {CATEGORY_LABELS[c]}
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-500 hover:underline"
        >
          キャンセル
        </button>
        <button
          type="button"
          disabled={disabled || selected.length === 0}
          onClick={() => onSave(selected)}
          className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </div>
  );
}
