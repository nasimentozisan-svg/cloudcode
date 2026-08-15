"use client";

import { useActionState } from "react";
import { createEventAction, type ActionState } from "@/lib/actions/schedule";
import CategoryCheckboxGroup from "@/components/CategoryCheckboxGroup";
import SubmitButton from "@/components/SubmitButton";

const initialState: ActionState = {};

export default function CreateEventForm() {
  const [state, formAction] = useActionState(createEventAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          タイトル
        </label>
        <input
          name="title"
          required
          placeholder="練習 / 対〇〇FC"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">日付</label>
          <input
            name="startDate"
            type="date"
            required
            onClick={(e) => e.currentTarget.showPicker?.()}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">時刻</label>
          <input
            name="startTime"
            type="time"
            required
            onClick={(e) => e.currentTarget.showPicker?.()}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          場所（任意）
        </label>
        <input
          name="location"
          placeholder="〇〇体育館"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          対象カテゴリー（複数選択可）
        </label>
        <div className="mt-1">
          <CategoryCheckboxGroup exclude={["GUARDIAN"]} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          持ち物・メモ（任意）
        </label>
        <textarea
          name="notes"
          rows={3}
          placeholder="体育館シューズ持参など"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton>予定を作成する</SubmitButton>
    </form>
  );
}
