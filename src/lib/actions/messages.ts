"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { canAccessChannel } from "@/lib/channels";
import { createChannelSchema, messageBodySchema } from "@/lib/validation";
import { sendNotificationEmails, escapeHtml } from "@/lib/email";
import type { Category } from "@/generated/prisma/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

export type ActionState = { error?: string };

// Keeps storage bounded: once a channel passes this many messages, the
// oldest ones are deleted on the next post.
const MAX_MESSAGES_PER_CHANNEL = 500;

export async function createChannelAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "ログインが必要です" };

  const parsed = createChannelSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    isGlobal: formData.get("isGlobal") === "on",
    categories: formData.getAll("categories"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { name, description, isGlobal, categories } = parsed.data;

  const existing = await prisma.channel.findUnique({ where: { name } });
  if (existing) {
    return { error: "そのチャンネル名は既に使われています" };
  }

  const channel = await prisma.channel.create({
    data: {
      name,
      description: description ?? null,
      isGlobal,
      createdById: user.id,
      categories: isGlobal
        ? undefined
        : { create: (categories as Category[]).map((category) => ({ category })) },
    },
  });

  revalidatePath("/messages");
  redirect(`/messages/${channel.id}`);
}

export async function postMessageAction(channelId: string, body: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");

  const parsed = messageBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { categories: true },
  });
  if (!channel) throw new Error("チャンネルが見つかりません");
  if (!canAccessChannel(user, channel)) {
    throw new Error("このチャンネルに投稿する権限がありません");
  }

  await prisma.message.create({
    data: { channelId, authorId: user.id, body: parsed.data },
  });

  const allUsers = await prisma.user.findMany({
    where: { id: { not: user.id }, receiveEmailNotifications: true },
    select: { id: true, email: true, isAdmin: true, categories: { select: { category: true } } },
  });
  const recipients = allUsers.filter((u) => canAccessChannel(u, channel));
  await sendNotificationEmails(
    recipients,
    `【EFK members】# ${channel.name} に新着メッセージ`,
    `<p><strong>${escapeHtml(user.name)}</strong> さんが # ${escapeHtml(channel.name)} に投稿しました。</p>
    <p style="white-space:pre-wrap">${escapeHtml(parsed.data)}</p>
    ${APP_URL ? `<p><a href="${APP_URL}/messages/${channelId}">チャンネルを開く</a></p>` : ""}`
  );

  const count = await prisma.message.count({ where: { channelId } });
  if (count > MAX_MESSAGES_PER_CHANNEL) {
    const oldest = await prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: "asc" },
      take: count - MAX_MESSAGES_PER_CHANNEL,
      select: { id: true },
    });
    await prisma.message.deleteMany({ where: { id: { in: oldest.map((m) => m.id) } } });
  }

  revalidatePath(`/messages/${channelId}`);
}

export async function deleteChannelAction(channelId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");

  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return;
  if (channel.isDefault) throw new Error("デフォルトのチャンネルは削除できません");
  if (!user.isAdmin && channel.createdById !== user.id) {
    throw new Error("このチャンネルを削除する権限がありません");
  }

  await prisma.channel.delete({ where: { id: channelId } });
  revalidatePath("/messages");
}
