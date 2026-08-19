"use server";

import { del } from "@/lib/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { canAccessChannel } from "@/lib/channels";
import { isViewOnly } from "@/lib/categories";
import { createChannelSchema, messageBodySchema } from "@/lib/validation";
import { escapeHtml } from "@/lib/email";
import { notifyRecipients } from "@/lib/notify";
import { findMentions } from "@/lib/mentions";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";
import { ATTACHMENT_RETENTION_DAYS, MAX_ATTACHMENTS_PER_MESSAGE } from "@/lib/attachments";
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
  if (isViewOnly(user.categories.map((c) => c.category))) {
    return { error: "この種類のアカウントはメッセージ機能を利用できません" };
  }

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

export async function postMessageAction(
  channelId: string,
  body: string,
  attachments?: { url: string; name: string }[]
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");
  if (isViewOnly(user.categories.map((c) => c.category))) {
    throw new Error("この種類のアカウントはメッセージ機能を利用できません");
  }

  const trimmedBody = body.trim();
  const files = attachments ?? [];
  if (trimmedBody.length === 0 && files.length === 0) {
    throw new Error("メッセージを入力するか、ファイルを添付してください");
  }
  if (trimmedBody.length > 0) {
    const parsed = messageBodySchema.safeParse(trimmedBody);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
    }
  }
  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new Error(`添付ファイルは${MAX_ATTACHMENTS_PER_MESSAGE}個までです`);
  }
  // The uploads already happened client-side straight to Blob storage (see
  // /api/upload) - this is just a sanity check that we were handed real
  // blob URLs, not some arbitrary link dressed up as an attachment.
  if (files.some((f) => !f.url.includes(".blob.vercel-storage.com"))) {
    throw new Error("添付ファイルのURLが不正です");
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { categories: true },
  });
  if (!channel) throw new Error("チャンネルが見つかりません");
  if (!canAccessChannel(user, channel)) {
    throw new Error("このチャンネルに投稿する権限がありません");
  }

  const attachmentExpiresAt = new Date(Date.now() + ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.message.create({
    data: {
      channelId,
      authorId: user.id,
      body: trimmedBody,
      attachments: {
        create: files.map((f) => ({ path: f.url, name: f.name, expiresAt: attachmentExpiresAt })),
      },
    },
  });

  // Only @mentioned people are notified (or everyone, for @全員) — a plain
  // message with no mention sends nothing, so casual chat doesn't spam
  // everyone's email/push/LINE. See src/lib/mentions.ts.
  const allUsers = await prisma.user.findMany({
    where: { id: { not: user.id } },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      receiveEmailNotifications: true,
      categories: { select: { category: true } },
    },
  });
  const channelMembers = allUsers.filter((u) => canAccessChannel(u, channel));
  const { userIds: mentionedIds, all: mentionsAll } = findMentions(trimmedBody, channelMembers);
  const recipients = channelMembers.filter((u) => mentionsAll || mentionedIds.includes(u.id));
  if (recipients.length > 0) {
    await notifyRecipients(
      recipients,
      {
        subject: `【EFK members】# ${channel.name} でメンションされました`,
        html: `<p><strong>${escapeHtml(user.name)}</strong> さんが # ${escapeHtml(channel.name)} であなたにメンションしました。</p>
        <p style="white-space:pre-wrap">${escapeHtml(trimmedBody)}</p>
        ${APP_URL ? `<p><a href="${APP_URL}/messages/${channelId}">チャンネルを開く</a></p>` : ""}`,
      },
      { title: `# ${channel.name}`, body: `${user.name}: ${trimmedBody}`, url: `/messages/${channelId}` },
      `【EFK members】# ${channel.name}\n${user.name}さんがメンションしました\n${trimmedBody}`
    );
  }

  const count = await prisma.message.count({ where: { channelId } });
  if (count > MAX_MESSAGES_PER_CHANNEL) {
    const oldest = await prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: "asc" },
      take: count - MAX_MESSAGES_PER_CHANNEL,
      select: { id: true, attachments: { select: { path: true } } },
    });
    await Promise.allSettled(
      oldest.flatMap((m) => m.attachments.map((a) => del(a.path)))
    );
    await prisma.message.deleteMany({ where: { id: { in: oldest.map((m) => m.id) } } });
  }

  revalidatePath(`/messages/${channelId}`);
}

export async function deleteMessageAction(messageId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { attachments: { select: { path: true } } },
  });
  if (!message) return;
  if (!user.isAdmin && message.authorId !== user.id) {
    throw new Error("このメッセージを削除する権限がありません");
  }

  await Promise.allSettled(message.attachments.map((a) => del(a.path).catch(() => {})));
  await prisma.message.delete({ where: { id: messageId } });
  revalidatePath(`/messages/${message.channelId}`);
}

export async function toggleReactionAction(messageId: string, emoji: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");
  if (isViewOnly(user.categories.map((c) => c.category))) {
    throw new Error("この種類のアカウントはメッセージ機能を利用できません");
  }
  if (!REACTION_EMOJIS.includes(emoji as ReactionEmoji)) {
    throw new Error("使用できないリアクションです");
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { channel: { include: { categories: true } } },
  });
  if (!message) throw new Error("メッセージが見つかりません");
  if (!canAccessChannel(user, message.channel)) {
    throw new Error("このチャンネルにアクセスする権限がありません");
  }

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId: user.id, emoji } },
  });
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({ data: { messageId, userId: user.id, emoji } });
  }

  revalidatePath(`/messages/${message.channelId}`);
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
