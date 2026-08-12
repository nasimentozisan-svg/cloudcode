"use client";

import { useActionState } from "react";
import { createUserByAdminAction } from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/auth";
import CategoryCheckboxGroup from "@/components/CategoryCheckboxGroup";
import SubmitButton from "@/components/SubmitButton";

const initialState: ActionState = {};

export default function AdminCreateUserForm() {
  const [state, formAction] = useActionState(createUserByAdminAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <input
        name="name"
        required
        placeholder="名前"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="uniformNumber"
        type="number"
        min={0}
        max={999}
        placeholder="背番号（任意）"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <div className="sm:col-span-2">
        <p className="mb-1 text-sm text-gray-500">カテゴリー（複数選択可）</p>
        <CategoryCheckboxGroup />
      </div>

      <input
        name="email"
        type="email"
        required
        placeholder="メールアドレス"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="初期パスワード（8文字以上）"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {state.error && (
        <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton>アカウントを追加</SubmitButton>
      </div>
    </form>
  );
}
