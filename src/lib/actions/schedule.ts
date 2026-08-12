"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { canManageSchedule } from "@/lib/schedule-permissions";
import { createEventSchema } from "@/lib/validation";
import type { AttendanceStatus, Category } from "@/generated/prisma/client";

export type ActionState = { error?: string };

export async function createEventAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || !canManageSchedule(user)) {
    return { error: "予定を作成する権限がありません" };
  }

  const parsed = createEventSchema.safeParse({
    title: formData.get("title"),
    startAt: formData.get("startAt"),
    location: formData.get("location"),
    notes: formData.get("notes"),
    categories: formData.getAll("categories"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { title, startAt, location, notes, categories } = parsed.data;
  const startAtDate = new Date(startAt);
  if (Number.isNaN(startAtDate.getTime())) {
    return { error: "日時の形式が正しくありません" };
  }

  await prisma.event.create({
    data: {
      title,
      startAt: startAtDate,
      location: location ?? null,
      notes: notes ?? null,
      createdById: user.id,
      categories: {
        create: (categories as Category[]).map((category) => ({ category })),
      },
    },
  });

  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  redirect("/schedule");
}

export async function respondToEventAction(eventId: string, status: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");
  if (!["ATTENDING", "ABSENT", "UNDECIDED"].includes(status)) {
    throw new Error("不正な出欠状態です");
  }

  await prisma.attendanceResponse.upsert({
    where: { eventId_userId: { eventId, userId: user.id } },
    create: { eventId, userId: user.id, status: status as AttendanceStatus },
    update: { status: status as AttendanceStatus },
  });

  revalidatePath("/schedule");
  revalidatePath("/dashboard");
}

export async function deleteEventAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return;
  if (!user.isAdmin && event.createdById !== user.id) {
    throw new Error("この予定を削除する権限がありません");
  }

  await prisma.event.delete({ where: { id: eventId } });
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
}
