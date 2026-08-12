"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { registerSchema, categoryEnum } from "@/lib/validation";
import { roleForCategory } from "@/lib/categories";
import type { Category } from "@/generated/prisma/client";
import type { ActionState } from "@/lib/actions/auth";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    throw new Error("管理者権限が必要です");
  }
  return user;
}

export async function createUserByAdminAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    category: formData.get("category"),
    uniformNumber: formData.get("uniformNumber"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { name, email, password, category, uniformNumber } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "このメールアドレスは既に登録されています" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      category: category as Category,
      role: roleForCategory(category as Category),
      uniformNumber: uniformNumber ?? null,
    },
  });

  revalidatePath("/admin");
  return {};
}

export async function updateUserCategoryAction(userId: string, category: string) {
  await requireAdmin();
  const parsed = categoryEnum.safeParse(category);
  if (!parsed.success) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      category: parsed.data as Category,
      role: roleForCategory(parsed.data as Category),
    },
  });

  revalidatePath("/admin");
}

export async function toggleAdminAction(userId: string, makeAdmin: boolean) {
  const actor = await requireAdmin();

  if (actor.id === userId && !makeAdmin) {
    throw new Error("自分自身の管理者権限は剥奪できません");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isAdmin: makeAdmin },
  });

  revalidatePath("/admin");
}

export async function deleteUserAction(userId: string) {
  const actor = await requireAdmin();
  if (actor.id === userId) {
    throw new Error("自分自身は削除できません");
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
}
