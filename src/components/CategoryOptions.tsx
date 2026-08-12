import { CATEGORY_LABELS, CATEGORY_OPTIONS } from "@/lib/categories";

export default function CategoryOptions() {
  return (
    <>
      {CATEGORY_OPTIONS.map((c) => (
        <option key={c} value={c}>
          {CATEGORY_LABELS[c]}
        </option>
      ))}
    </>
  );
}
