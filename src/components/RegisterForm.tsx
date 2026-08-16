"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { registerAction, type ActionState } from "@/lib/actions/auth";
import CategoryCheckboxGroup from "@/components/CategoryCheckboxGroup";
import WearSizeFields from "@/components/WearSizeFields";
import SubmitButton from "@/components/SubmitButton";
import type { Category } from "@/generated/prisma/client";

const initialState: ActionState = {};

export default function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);
  const [categories, setCategories] = useState<Category[]>([]);
  const isGuardian = categories.includes("GUARDIAN");

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
          <CategoryCheckboxGroup
            onChange={(c, checked) =>
              setCategories((prev) => (checked ? [...prev, c] : prev.filter((x) => x !== c)))
            }
          />
        </div>
      </div>

      {isGuardian && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            お子さんの所属カテゴリー（複数選択可）
          </label>
          <p className="mt-0.5 text-xs text-gray-500">
            出欠の回答には使いません。カレンダーの予定の色分け表示を、お子さんのカテゴリー優先にするために使います。
          </p>
          <div className="mt-1">
            <CategoryCheckboxGroup
              name="guardianChildCategories"
              exclude={["TOP_COACH", "SATELLITE_COACH", "U18_COACH", "GUARDIAN", "SUPPORTER"]}
            />
          </div>
        </div>
      )}

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
          autoComplete="username"
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
          autoComplete="new-password"
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
