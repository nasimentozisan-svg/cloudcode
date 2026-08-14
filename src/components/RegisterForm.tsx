"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type ActionState } from "@/lib/actions/auth";
import CategoryCheckboxGroup from "@/components/CategoryCheckboxGroup";
import WearSizeFields from "@/components/WearSizeFields";
import SubmitButton from "@/components/SubmitButton";

const initialState: ActionState = {};

export default function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">名前</label>
        <input
          name="name"
          required
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="山田 太郎"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          カテゴリー（複数選択可）
        </label>
        <div className="mt-1">
          <CategoryCheckboxGroup />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          背番号（選手のみ・任意）
        </label>
        <input
          name="uniformNumber"
          type="number"
          min={0}
          max={999}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="10"
        />
      </div>

      <WearSizeFields />

      <div>
        <label className="block text-sm font-medium text-gray-700">
          メールアドレス
        </label>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="you@example.com"
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

      <SubmitButton>登録する</SubmitButton>

      <p className="text-center text-sm text-gray-500">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="text-emerald-600 hover:underline active:text-emerald-800">
          ログイン
        </Link>
      </p>
    </form>
  );
}
