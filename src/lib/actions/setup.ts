"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { registerSchema } from "@/lib/validation";
import type { Category } from "@/generated/prisma/client";
import type { ActionState } from "@/lib/actions/auth";

export async function hasAdmin(): Promise<boolean> {
  const admin = await prisma.user.findFirst({ where: { isAdmin: true } });
  return admin !== null;
}

export async function setupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (await hasAdmin()) {
    return { error: "管理者は既に作成済みです。ログインしてください。" };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    categories: formData.getAll("categories"),
    uniformNumber: formData.get("uniformNumber"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { name, email, password, categories, uniformNumber } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      uniformNumber: uniformNumber ?? null,
      isAdmin: true,
      categories: {
        create: (categories as Category[]).map((category) => ({ category })),
      },
    },
  });

  await createSession(user.id);
  redirect("/admin");
}
