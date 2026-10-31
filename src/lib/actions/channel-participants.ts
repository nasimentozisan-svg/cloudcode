"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { canAccessChannel } from "@/lib/channels";
import { canAddChannelParticipants } from "@/lib/channel-participant-permissions";
import { isViewOnly } from "@/lib/categories";

export type ParticipantActionState = { error?: string; success?: string };

export async function addChannelParticipantAction(
  channelId: string,
  _previous: ParticipantActionState,
  formData: FormData
): Promise<ParticipantActionState> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return { error: "ログインが必要です" };
  const targetId = formData.get("memberId");
  if (typeof channelId !== "string" || !channelId || channelId.length > 128 ||
      typeof targetId !== "string" || !targetId || targetId.length > 128) {
    return { error: "追加するメンバーを選んでください" };
  }

  try {
    const result = await prisma.$transaction(async tx => {
      // Re-read authority inside the same serializable transaction as the write.
      // Never trust the candidates/permissions sent to the browser on a prior render.
      const actor = await tx.user.findUnique({ where: { id: sessionUser.id }, include: { categories: true } });
      const channel = await tx.channel.findUnique({
        where: { id: channelId },
        include: { categories: true, members: { select: { userId: true } }, leaves: { select: { userId: true } } },
      });
      if (!actor || !channel || !canAccessChannel(actor, channel) || !canAddChannelParticipants(actor, channel)) {
        return { error: "このチャンネルにメンバーを追加する権限がありません" };
      }
      // Authorize first, so outsiders cannot use this action as a user directory.
      const target = await tx.user.findUnique({ where: { id: targetId }, include: { categories: true } });
      if (!target || isViewOnly(target.categories.map(c => c.category))) {
        return { error: "このメンバーは追加できません。一覧を更新してください" };
      }
      if (canAccessChannel(target, channel)) return { success: "このメンバーはすでに参加しています" };
      // Existing app invitations grant immediate access, with no acceptance or notification.
      // Leave records are retained: explicit membership already overrides them.
      await tx.channelMember.upsert({
        where: { channelId_userId: { channelId, userId: target.id } },
        create: { channelId, userId: target.id },
        update: {},
      });
      return { success: "メンバーを追加しました" };
    }, { isolationLevel: "Serializable" });
    if (result.success) {
      revalidatePath(`/messages/${channelId}`);
      revalidatePath("/messages");
    }
    return result;
  } catch {
    // Includes concurrent permission changes/deletion/serialization conflicts.
    // Do not expose database details or silently fall back to a weaker write.
    return { error: "追加結果を確認できませんでした。一覧を更新して確認してください" };
  }
}
