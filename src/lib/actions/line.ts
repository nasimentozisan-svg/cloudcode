"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function generateLineLinkCodeAction(): Promise<{ code: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");

  const code = randomBytes(4).toString("hex").toUpperCase();
  await prisma.user.update({ where: { id: user.id }, data: { lineLinkCode: code } });
  revalidatePath("/dashboard");
  return { code };
}

export async function unlinkLineAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");

  await prisma.user.update({
    where: { id: user.id },
    data: { lineUserId: null, lineLinkCode: null },
  });
  revalidatePath("/dashboard");
}
