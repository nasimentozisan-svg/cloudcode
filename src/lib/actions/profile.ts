"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { updateSizesSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";

export async function updateSizesAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "ログインが必要です" };

  const parsed = updateSizesSchema.safeParse({
    shirtSize: formData.get("shirtSize"),
    pantsSize: formData.get("pantsSize"),
    jerseySize: formData.get("jerseySize"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { shirtSize, pantsSize, jerseySize } = parsed.data;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      shirtSize: shirtSize ?? null,
      pantsSize: pantsSize ?? null,
      jerseySize: jerseySize ?? null,
    },
  });

  revalidatePath("/dashboard");
  return {};
}

export async function updateNotificationPrefAction(receiveEmailNotifications: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");

  await prisma.user.update({
    where: { id: user.id },
    data: { receiveEmailNotifications },
  });

  revalidatePath("/dashboard");
}
