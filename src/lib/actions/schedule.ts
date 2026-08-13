"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { canManageSchedule } from "@/lib/schedule-permissions";
import { createEventSchema, categoryEnum } from "@/lib/validation";
import { sendNotificationEmails, escapeHtml } from "@/lib/email";
import { CATEGORY_LABELS } from "@/lib/categories";
import type { AttendanceStatus, Category } from "@/generated/prisma/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

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

  const recipients = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      receiveEmailNotifications: true,
      categories: { some: { category: { in: categories as Category[] } } },
    },
    select: { email: true },
  });
  const dateLabel = startAtDate.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  await sendNotificationEmails(
    recipients,
    `【EFK members】新しい予定が作成されました: ${title}`,
    `<p>新しい予定が作成されました。</p>
    <p><strong>${escapeHtml(title)}</strong><br>
    ${dateLabel}${location ? ` ・ ${escapeHtml(location)}` : ""}<br>
    対象: ${(categories as Category[]).map((c) => CATEGORY_LABELS[c]).join(" / ")}</p>
    ${APP_URL ? `<p><a href="${APP_URL}/schedule">スケジュールを確認する</a></p>` : ""}`
  );

  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  redirect("/schedule");
}

export type BulkEventInput = { title: string; startAt: string; location: string | null };

// Used by the free text-paste bulk import (see src/lib/schedule-import.ts):
// events are already parsed client-side, this just validates and persists
// them, sending one consolidated notification email instead of one per
// event so importing a season's schedule doesn't spam everyone's inbox.
export async function bulkCreateEventsAction(
  events: BulkEventInput[],
  categories: string[]
): Promise<{ error?: string; created?: number }> {
  const user = await getCurrentUser();
  if (!user || !canManageSchedule(user)) {
    return { error: "予定を作成する権限がありません" };
  }

  const parsedCategories = categoryEnum.array().min(1).safeParse(categories);
  if (!parsedCategories.success) {
    return { error: "対象カテゴリーを1つ以上選択してください" };
  }
  if (!Array.isArray(events) || events.length === 0) {
    return { error: "登録する予定がありません" };
  }
  if (events.length > 100) {
    return { error: "一度に登録できるのは100件までです" };
  }

  const validEvents: { title: string; startAt: Date; location: string | null }[] = [];
  for (const e of events) {
    const startAtDate = new Date(e.startAt);
    const title = e.title?.trim() ?? "";
    if (title.length === 0 || title.length > 100 || Number.isNaN(startAtDate.getTime())) {
      return { error: "入力内容に誤りがあります。プレビューを確認してください" };
    }
    validEvents.push({ title, startAt: startAtDate, location: e.location?.trim() || null });
  }

  const eventCategories = parsedCategories.data as Category[];

  await prisma.$transaction(
    validEvents.map((e) =>
      prisma.event.create({
        data: {
          title: e.title,
          startAt: e.startAt,
          location: e.location,
          createdById: user.id,
          categories: { create: eventCategories.map((category) => ({ category })) },
        },
      })
    )
  );

  const recipients = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      receiveEmailNotifications: true,
      categories: { some: { category: { in: eventCategories } } },
    },
    select: { email: true },
  });
  const listHtml = validEvents
    .map((e) => {
      const dateLabel = e.startAt.toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `<li>${escapeHtml(e.title)} - ${dateLabel}${e.location ? ` ・ ${escapeHtml(e.location)}` : ""}</li>`;
    })
    .join("");
  await sendNotificationEmails(
    recipients,
    `【EFK members】新しい予定が${validEvents.length}件登録されました`,
    `<p>新しい予定が${validEvents.length}件登録されました。</p>
    <ul>${listHtml}</ul>
    <p>対象: ${eventCategories.map((c) => CATEGORY_LABELS[c]).join(" / ")}</p>
    ${APP_URL ? `<p><a href="${APP_URL}/schedule">スケジュールを確認する</a></p>` : ""}`
  );

  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  return { created: validEvents.length };
}

export async function respondToEventAction(eventId: string, status: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");
  if (!["ATTENDING", "MATCH_ONLY", "ABSENT", "UNDECIDED"].includes(status)) {
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

export async function updateEventNotesAction(
  eventId: string,
  notes: string
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user || !canManageSchedule(user)) {
    return { error: "備考を編集する権限がありません" };
  }

  const trimmed = notes.trim();
  if (trimmed.length > 1000) {
    return { error: "備考は1000文字以内で入力してください" };
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: "予定が見つかりません" };

  await prisma.event.update({
    where: { id: eventId },
    data: { notes: trimmed.length > 0 ? trimmed : null },
  });

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${eventId}`);
  return {};
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
