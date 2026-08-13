"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { canManageSchedule } from "@/lib/schedule-permissions";
import { matchResultSchema } from "@/lib/validation";

export type MatchResultActionState = { error?: string; ok?: boolean };

export type ScorerInput = { number?: number; name: string; goals: number };

export async function saveMatchResultAction(
  eventId: string,
  input: { opponent: string; ourScore: number; opponentScore: number; scorers: ScorerInput[] }
): Promise<MatchResultActionState> {
  const user = await getCurrentUser();
  if (!user || !canManageSchedule(user)) {
    return { error: "試合結果を入力する権限がありません" };
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: "予定が見つかりません" };

  const parsed = matchResultSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }
  const { opponent, ourScore, opponentScore, scorers } = parsed.data;

  await prisma.matchResult.upsert({
    where: { eventId },
    create: {
      eventId,
      opponent,
      ourScore,
      opponentScore,
      recordedById: user.id,
      scorers: {
        create: scorers.map((s, i) => ({
          number: s.number ?? null,
          name: s.name,
          goals: s.goals,
          order: i,
        })),
      },
    },
    update: {
      opponent,
      ourScore,
      opponentScore,
      recordedById: user.id,
      scorers: {
        deleteMany: {},
        create: scorers.map((s, i) => ({
          number: s.number ?? null,
          name: s.name,
          goals: s.goals,
          order: i,
        })),
      },
    },
  });

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${eventId}/result`);
  return { ok: true };
}
