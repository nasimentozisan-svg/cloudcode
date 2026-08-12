"use client";

import { useActionState, useState } from "react";
import { createChannelAction, type ActionState } from "@/lib/actions/messages";
import CategoryCheckboxGroup from "@/components/CategoryCheckboxGroup";
import SubmitButton from "@/components/SubmitButton";

const initialState: ActionState = {};

export default function CreateChannelForm() {
  const [state, formAction] = useActionState(createChannelAction, initialState);
  const [isGlobal, setIsGlobal] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          チャンネル名
        </label>
        <input
          name="name"
          required
          placeholder="例: 保護者連絡"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          説明（任意）
        </label>
        <input
          name="description"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="isGlobal"
            checked={isGlobal}
            onChange={(e) => setIsGlobal(e.target.checked)}
          />
          全員が参加できるチャンネルにする
        </label>
      </div>

      {!isGlobal && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            対象カテゴリー（複数選択可）
          </label>
          <div className="mt-1">
            <CategoryCheckboxGroup />
          </div>
        </div>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton>チャンネルを作成</SubmitButton>
    </form>
  );
}
