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
        name="rosters"
        accept="application/pdf"
        multiple
        required
        className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
      />
      <p className="text-xs text-gray-500">
        JFAの「登録選手一覧」PDF（トップ・サテライト・U18など、カテゴリーごと）をそのままアップロードできます。
        複数選択可。名簿に載っている名前・背番号・写真を読み取り、登録済みメンバーと自動で紐付けます。
        選手が増えたときは、更新した名簿PDFを同じようにアップロードし直せば反映されます。
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
