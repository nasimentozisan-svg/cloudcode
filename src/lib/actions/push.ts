"use server";

import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToOwnDevice, type SinglePushResult } from "@/lib/push";
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

const TEST_PAYLOAD = {
  title: "EFK members テスト通知",
  body: "この端末でプッシュ通知を受け取れています。タップするとスケジュールを開きます。",
  url: "/schedule",
};

// Test notification to the calling device only (its own endpoint, checked
// against the logged-in user). With a delay, it's sent after the response
// so the tester can close the app or turn the screen off first.
export async function sendTestPushAction(
  endpoint: string,
  delaySeconds: 0 | 15
): Promise<SinglePushResult | "scheduled"> {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");
  const delay = delaySeconds === 15 ? 15 : 0;

  if (delay === 0) {
    const result = await sendPushToOwnDevice(user.id, endpoint, TEST_PAYLOAD);
    console.log(`[push-test] delay=0 result=${result}`);
    return result;
  }

  const owned = await prisma.pushSubscription.findFirst({ where: { endpoint, userId: user.id } });
  if (!owned) return "not_registered";
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    const result = await sendPushToOwnDevice(user.id, endpoint, TEST_PAYLOAD);
    console.log(`[push-test] delay=${delay} result=${result}`);
  });
  return "scheduled";
}
