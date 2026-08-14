"use client";

import { useActionState } from "react";
import { updateEventAction, type ActionState } from "@/lib/actions/schedule";
import CategoryCheckboxGroup from "@/components/CategoryCheckboxGroup";
import SubmitButton from "@/components/SubmitButton";
import type { Category } from "@/generated/prisma/client";

const initialState: ActionState = {};

export default function EditEventForm({
  eventId,
  initialTitle,
  initialStartAt,
  initialLocation,
  initialNotes,
  initialCategories,
}: {
  eventId: string;
  initialTitle: string;
  initialStartAt: string;
  initialLocation: string;
  initialNotes: string;
  initialCategories: Category[];
}) {
  const [state, formAction] = useActionState(updateEventAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />

      <div>
        <label className="block text-sm font-medium text-gray-700">
          タイトル
        </label>
        <input
          name="title"
          required
          defaultValue={initialTitle}
          placeholder="練習 / 対〇〇FC"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">日時</label>
        <input
          name="startAt"
          type="datetime-local"
          required
          defaultValue={initialStartAt}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          場所（任意）
        </label>
        <input
          name="location"
          defaultValue={initialLocation}
          placeholder="〇〇体育館"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          対象カテゴリー（複数選択可）
        </label>
        <div className="mt-1">
          <CategoryCheckboxGroup exclude={["GUARDIAN"]} defaultChecked={initialCategories} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          持ち物・メモ（任意）
        </label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={initialNotes}
          placeholder="体育館シューズ持参など"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton>保存する</SubmitButton>
    </form>
  );
}
