"use client";

import { useActionState } from "react";
import { uploadCardsAction, type UploadCardsState } from "@/lib/actions/cards";
import SubmitButton from "@/components/SubmitButton";

const initialState: UploadCardsState = { matched: 0, pending: 0 };

export default function UploadCardsForm() {
  const [state, formAction] = useActionState(uploadCardsAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input
        type="file"
        name="images"
        accept="image/*"
        multiple
        required
        className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
      />
      <p className="text-xs text-gray-500">
        複数選択できます。1枚ずつ文字を読み取って名前を照合するため、枚数が多いと時間がかかります。
      </p>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {!state.error && (state.matched > 0 || state.pending > 0) && (
        <p className="text-sm text-emerald-700">
          自動で紐付け: {state.matched}件 / 要確認: {state.pending}件
        </p>
      )}

      <SubmitButton>アップロードして自動紐付け</SubmitButton>
    </form>
  );
}
