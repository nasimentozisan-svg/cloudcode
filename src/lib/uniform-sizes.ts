// Kept independent of the generated Prisma client's runtime enum object:
// this file is imported from client components (form dropdowns), and the
// Prisma client module pulls in Node-only APIs that can't be bundled for
// the browser. The literal values below must stay in sync with the
// UniformSize enum in prisma/schema.prisma.
import type { UniformSize } from "@/generated/prisma/client";

export const UNIFORM_SIZE_OPTIONS: UniformSize[] = ["S", "M", "L", "XL", "XXL"];

export const UNIFORM_SIZE_LABELS: Record<UniformSize, string> = {
  S: "S",
  M: "M",
  L: "L",
  XL: "XL",
  XXL: "XXL",
};
