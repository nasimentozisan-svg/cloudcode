import { CATEGORY_LABELS, CATEGORY_OPTIONS } from "@/lib/categories";
import type { Category } from "@/generated/prisma/client";

export default function CategoryCheckboxGroup({
  name = "categories",
  defaultChecked = [],
}: {
  name?: string;
  defaultChecked?: Category[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border border-gray-300 p-3 sm:grid-cols-3">
      {CATEGORY_OPTIONS.map((c) => (
        <label key={c} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name={name}
            value={c}
            defaultChecked={defaultChecked.includes(c)}
          />
          {CATEGORY_LABELS[c]}
        </label>
      ))}
    </div>
  );
}
