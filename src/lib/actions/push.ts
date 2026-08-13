"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function subscribePushAction(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
    update: { userId: user.id, p256dh: sub.p256dh, auth: sub.auth },
  });
}

export async function unsubscribePushAction(endpoint: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
}
