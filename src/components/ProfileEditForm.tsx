"use client";

import { useActionState, useEffect, useState } from "react";
import { updateProfileAction } from "@/lib/actions/profile";
import CategoryCheckboxGroup from "@/components/CategoryCheckboxGroup";
import SubmitButton from "@/components/SubmitButton";
import type { ActionState } from "@/lib/actions/auth";
import type { Category } from "@/generated/prisma/client";

const initialState: ActionState = {};

export default function ProfileEditForm({
  name,
  email,
  uniformNumber,
  isViewOnly,
  isGuardian,
  guardianChildCategories,
}: {
  name: string;
  email: string;
  uniformNumber: number | null;
  isViewOnly: boolean;
  isGuardian: boolean;
  guardianChildCategories: Category[];
}) {
  const [state, formAction] = useActionState(updateProfileAction, initialState);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing || state.error) return;
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!editing) {
    return (
      <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
        <dt className="text-gray-500">名前</dt>
        <dd className="col-span-1 sm:col-span-3">{name}</dd>
        <dt className="text-gray-500">メール</dt>
        <dd className="col-span-1 sm:col-span-3">{email}</dd>
        {!isViewOnly && (
          <>
            <dt className="text-gray-500">背番号</dt>
            <dd className="col-span-1 sm:col-span-3">{uniformNumber ?? "未設定"}</dd>
          </>
        )}
        <dt className="col-span-2 sm:col-span-4">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-1 text-xs text-emerald-700 hover:underline"
          >
            プロフィールを編集
          </button>
        </dt>
      </dl>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500">名前</label>
        <input
          name="name"
          required
          defaultValue={name}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500">メールアドレス</label>
        <input
          name="email"
          type="email"
          required
          defaultValue={email}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      {!isViewOnly && (
        <div>
          <label className="block text-xs text-gray-500">背番号（任意）</label>
          <input
            name="uniformNumber"
            type="number"
            min={0}
            max={999}
            defaultValue={uniformNumber ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      )}
      {isGuardian && (
        <div>
          <label className="block text-xs text-gray-500">お子さんの所属カテゴリー（複数選択可）</label>
          <p className="mt-0.5 text-xs text-gray-400">
            出欠の回答には使いません。カレンダーの色分け表示に使用します。
          </p>
          <div className="mt-1">
            <CategoryCheckboxGroup
              name="guardianChildCategories"
              exclude={["TOP_COACH", "SATELLITE_COACH", "U18_COACH", "GUARDIAN", "SUPPORTER"]}
              defaultChecked={guardianChildCategories}
            />
          </div>
        </div>
      )}

      {state.error && <p className="text-xs text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <div className="w-20">
          <SubmitButton>保存</SubmitButton>
        </div>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-gray-500 hover:underline"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
