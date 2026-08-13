import { Category } from "@/generated/prisma/client";

export const CATEGORY_LABELS: Record<Category, string> = {
  TOP_PLAYER: "トップ選手",
  TOP_COACH: "トップコーチ",
  SATELLITE_PLAYER: "サテライト選手",
  SATELLITE_COACH: "サテライトコーチ",
  U18_PLAYER: "U18(U15)選手",
  U18_COACH: "U18コーチ",
  GUARDIAN: "保護者",
};

export const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as Category[];

export function isPlayerCategory(category: Category): boolean {
  return !category.endsWith("_COACH");
}

export function categoriesIncludePlayer(categories: Category[]): boolean {
  return categories.some(isPlayerCategory);
}

export function formatCategories(categories: Category[]): string {
  return [...categories]
    .sort((a, b) => CATEGORY_OPTIONS.indexOf(a) - CATEGORY_OPTIONS.indexOf(b))
    .map((c) => CATEGORY_LABELS[c])
    .join(" / ");
}

export type CategoryGroup = "TOP" | "SATELLITE" | "U18" | "GUARDIAN";

export const CATEGORY_GROUPS: CategoryGroup[] = ["TOP", "SATELLITE", "U18", "GUARDIAN"];

export const CATEGORY_GROUP_LABELS: Record<CategoryGroup, string> = {
  TOP: "トップ",
  SATELLITE: "サテライト",
  U18: "U18",
  GUARDIAN: "保護者",
};

export function categoryGroup(category: Category): CategoryGroup {
  if (category.startsWith("TOP")) return "TOP";
  if (category.startsWith("SATELLITE")) return "SATELLITE";
  if (category === "GUARDIAN") return "GUARDIAN";
  return "U18";
}

export function categoryGroups(categories: Category[]): CategoryGroup[] {
  const present = new Set(categories.map(categoryGroup));
  return CATEGORY_GROUPS.filter((g) => present.has(g));
}

// Color coding shared by the schedule calendar and event cards, keyed by
// category group (not the finer-grained player/coach category) so a single
// event that targets e.g. TOP_PLAYER + TOP_COACH shows one consistent color.
export const CATEGORY_GROUP_COLORS: Record<
  CategoryGroup,
  { dot: string; chipBg: string; chipText: string; border: string }
> = {
  TOP: { dot: "bg-blue-500", chipBg: "bg-blue-100", chipText: "text-blue-700", border: "border-blue-400" },
  SATELLITE: {
    dot: "bg-red-500",
    chipBg: "bg-red-100",
    chipText: "text-red-700",
    border: "border-red-400",
  },
  U18: {
    dot: "bg-green-500",
    chipBg: "bg-green-100",
    chipText: "text-green-700",
    border: "border-green-400",
  },
  GUARDIAN: {
    dot: "bg-purple-500",
    chipBg: "bg-purple-100",
    chipText: "text-purple-700",
    border: "border-purple-400",
  },
};
