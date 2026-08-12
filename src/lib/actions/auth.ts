"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";
import { registerSchema, loginSchema } from "@/lib/validation";
import type { Category } from "@/generated/prisma/client";

export type ActionState = { error?: string };

export async function registerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    categories: formData.getAll("categories"),
    uniformNumber: formData.get("uniformNumber"),
    shirtSize: formData.get("shirtSize"),
    pantsSize: formData.get("pantsSize"),
    jerseySize: formData.get("jerseySize"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { name, email, password, categories, uniformNumber, shirtSize, pantsSize, jerseySize } =
    parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "このメールアドレスは既に登録されています" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      uniformNumber: uniformNumber ?? null,
      shirtSize: shirtSize ?? null,
      pantsSize: pantsSize ?? null,
      jerseySize: jerseySize ?? null,
      categories: {
        create: (categories as Category[]).map((category) => ({ category })),
      },
    },
  });

  await createSession(user.id);
  redirect("/dashboard");
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "メールアドレスまたはパスワードが違います" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "メールアドレスまたはパスワードが違います" };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
