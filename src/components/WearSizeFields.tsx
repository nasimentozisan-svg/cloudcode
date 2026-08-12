import { UNIFORM_SIZE_OPTIONS, UNIFORM_SIZE_LABELS } from "@/lib/uniform-sizes";
import type { UniformSize } from "@/generated/prisma/client";

const FIELDS: { name: "shirtSize" | "pantsSize" | "jerseySize"; label: string }[] = [
  { name: "shirtSize", label: "シャツ" },
  { name: "pantsSize", label: "パンツ" },
  { name: "jerseySize", label: "ジャージ" },
];

export default function WearSizeFields({
  defaultValues,
  compact,
}: {
  defaultValues?: Partial<Record<"shirtSize" | "pantsSize" | "jerseySize", UniformSize | null>>;
  compact?: boolean;
}) {
  return (
    <div>
      {!compact && (
        <p className="block text-sm font-medium text-gray-700">
          ウェアサイズ（大人男性用・任意）
        </p>
      )}
      <div className={`grid grid-cols-3 gap-2 ${compact ? "" : "mt-1"}`}>
        {FIELDS.map((f) => (
          <div key={f.name}>
            <label className="block text-xs text-gray-500">{f.label}</label>
            <select
              name={f.name}
              defaultValue={defaultValues?.[f.name] ?? ""}
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
      </div>
    </div>
  );
}
