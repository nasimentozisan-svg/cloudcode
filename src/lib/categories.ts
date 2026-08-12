import { Category, UserRole } from "@/generated/prisma/client";

export const CATEGORY_LABELS: Record<Category, string> = {
  TOP_PLAYER: "トップ選手",
  TOP_COACH: "トップコーチ",
  SATELLITE_PLAYER: "サテライト選手",
  SATELLITE_COACH: "サテライトコーチ",
  U18_PLAYER: "U18(U15)選手",
  U18_COACH: "U18コーチ",
};

export const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as Category[];

export function roleForCategory(category: Category): UserRole {
  return category.endsWith("_COACH") ? "COACH" : "PLAYER";
}

export function isPlayerCategory(category: Category): boolean {
  return roleForCategory(category) === "PLAYER";
}
