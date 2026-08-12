"use client";

import { useActionState, useEffect, useState } from "react";
import { updateSizesAction } from "@/lib/actions/profile";
import { UNIFORM_SIZE_OPTIONS, UNIFORM_SIZE_LABELS } from "@/lib/uniform-sizes";
import type { UniformSize } from "@/generated/prisma/client";
import type { ActionState } from "@/lib/actions/auth";
import SubmitButton from "@/components/SubmitButton";

const initialState: ActionState = {};

const FIELDS: { name: "shirtSize" | "pantsSize" | "jerseySize"; label: string }[] = [
  { name: "shirtSize", label: "シャツ" },
  { name: "pantsSize", label: "パンツ" },
  { name: "jerseySize", label: "ジャージ" },
];

export default function SizeEditForm({
  shirtSize,
  pantsSize,
  jerseySize,
}: {
  shirtSize: UniformSize | null;
  pantsSize: UniformSize | null;
  jerseySize: UniformSize | null;
}) {
  const [state, formAction] = useActionState(updateSizesAction, initialState);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.error) return;
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const defaults = { shirtSize, pantsSize, jerseySize };

  return (
    <form action={formAction} className="grid grid-cols-3 gap-2">
      {FIELDS.map((f) => (
        <div key={f.name}>
          <label className="block text-xs text-gray-500">{f.label}</label>
          <select
            name={f.name}
            defaultValue={defaults[f.name] ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="">未選択</option>
            {UNIFORM_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {UNIFORM_SIZE_LABELS[size]}
              </option>
            ))}
          </select>
        </div>
      ))}
      <div className="col-span-3 flex items-center gap-3">
        <div className="w-24">
          <SubmitButton>保存</SubmitButton>
        </div>
        {saved && <span className="text-xs text-emerald-600">保存しました</span>}
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
