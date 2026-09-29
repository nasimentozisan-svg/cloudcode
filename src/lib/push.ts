import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const configured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    VAPID_PUBLIC_KEY!,
    VAPID_PRIVATE_KEY!
  );
}

export type PushPayload = { title: string; body: string; url?: string };

export type PushSummary = { subscriptions: number; sent: number; expired: number; failed: number };

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<PushSummary> {
  const summary: PushSummary = { subscriptions: 0, sent: 0, expired: 0, failed: 0 };
  if (!configured || userIds.length === 0) return summary;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  summary.subscriptions = subscriptions.length;
  if (subscriptions.length === 0) return summary;

  const body = JSON.stringify(payload);
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        summary.sent++;
      } catch (e) {
        const statusCode = (e as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or was revoked by the browser - stop trying.
          summary.expired++;
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          summary.failed++;
          console.error("push send failed", statusCode, (e as { body?: string }).body ?? "");
        }
      }
    })
  );
  return summary;
}
