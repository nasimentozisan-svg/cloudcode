import { z } from "zod";
import { CATEGORY_OPTIONS } from "@/lib/categories";

export const categoryEnum = z.enum(
  CATEGORY_OPTIONS as [string, ...string[]]
);

const uniformSizeEnum = z.enum(["S", "M", "L", "XL", "XXL"]);

const uniformSizeField = z.preprocess(
  (v) => (typeof v === "string" && v.length > 0 ? v : undefined),
  uniformSizeEnum.optional()
);

export const registerSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(50),
  email: z.string().trim().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上にしてください").max(100),
  categories: z
    .array(categoryEnum)
    .min(1, "カテゴリーを1つ以上選択してください"),
  guardianChildCategories: z.array(categoryEnum).optional().default([]),
  uniformNumber: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 999), {
      message: "背番号は0〜999の数字で入力してください",
    }),
  shirtSize: uniformSizeField,
  pantsSize: uniformSizeField,
  jerseySize: uniformSizeField,
});

export const updateSizesSchema = z.object({
  shirtSize: uniformSizeField,
  pantsSize: uniformSizeField,
  jerseySize: uniformSizeField,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(50),
  email: z.string().trim().email("メールアドレスの形式が正しくありません"),
  uniformNumber: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 999), {
      message: "背番号は0〜999の数字で入力してください",
    }),
  guardianChildCategories: z.array(categoryEnum).optional().default([]),
});

export const loginSchema = z.object({
  email: z.string().trim().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export const createEventSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(100),
  startDate: z.string().min(1, "日付を入力してください"),
  startTime: z.string().min(1, "時刻を入力してください"),
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

export const createChannelSchema = z
  .object({
    name: z.string().trim().min(1, "チャンネル名を入力してください").max(50),
    description: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    isGlobal: z.boolean(),
    categories: z.array(categoryEnum),
  })
  .refine((data) => data.isGlobal || data.categories.length > 0, {
    message: "「全体」を選ぶか、対象カテゴリーを1つ以上選択してください",
    path: ["categories"],
  });

export const matchResultSchema = z.object({
  opponent: z.string().trim().min(1, "対戦相手を入力してください").max(100),
  ourScore: z.coerce.number().int().min(0).max(99),
  opponentScore: z.coerce.number().int().min(0).max(99),
  scorers: z
    .array(
      z.object({
        number: z.coerce.number().int().min(0).max(999).optional(),
        name: z.string().trim().min(1).max(50),
        goals: z.coerce.number().int().min(1).max(99),
      })
    )
    .max(50),
});

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, "メッセージを入力してください")
  .max(2000, "メッセージは2000文字以内で入力してください");
