import { z } from "zod";
import { CATEGORY_OPTIONS } from "@/lib/categories";

export const categoryEnum = z.enum(
  CATEGORY_OPTIONS as [string, ...string[]]
);

export const registerSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(50),
  email: z.string().trim().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上にしてください").max(100),
  categories: z
    .array(categoryEnum)
    .min(1, "カテゴリーを1つ以上選択してください"),
  uniformNumber: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 999), {
      message: "背番号は0〜999の数字で入力してください",
    }),
});

export const loginSchema = z.object({
  email: z.string().trim().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export const createEventSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(100),
  startAt: z.string().min(1, "日時を入力してください"),
  location: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  categories: z
    .array(categoryEnum)
    .min(1, "対象カテゴリーを1つ以上選択してください"),
});
