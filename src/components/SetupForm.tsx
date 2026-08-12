"use client";

import { useActionState } from "react";
import { setupAction } from "@/lib/actions/setup";
import type { ActionState } from "@/lib/actions/auth";
import CategoryOptions from "@/components/CategoryOptions";
import SubmitButton from "@/components/SubmitButton";

const initialState: ActionState = {};

export default function SetupForm() {
  const [state, formAction] = useActionState(setupAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">名前</label>
        <input
          name="name"
          required
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">カテゴリー</label>
        <select
          name="category"
          required
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          defaultValue="TOP_COACH"
        >
          <CategoryOptions />
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          メールアドレス
        </label>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          パスワード（8文字以上）
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton>管理者アカウントを作成</SubmitButton>
    </form>
  );
}
