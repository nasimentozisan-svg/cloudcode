import { prisma } from "@/lib/prisma";
import { sendNotificationEmails } from "@/lib/email";
import { sendPushToUsers, type PushPayload } from "@/lib/push";
import { sendLineMessages } from "@/lib/line";

export type NotifyRecipient = { id: string; email: string; receiveEmailNotifications: boolean };

// Fans a single notification out to every channel a recipient has opted
// into: email (existing receiveEmailNotifications toggle), browser push
// (has a PushSubscription row), and LINE (has linked a lineUserId). Each
// channel silently no-ops for recipients who haven't opted into it, so
// callers don't need to branch per channel.
export async function notifyRecipients(
  recipients: NotifyRecipient[],
  email: { subject: string; html: string },
  push: PushPayload,
  lineText: string
): Promise<void> {
  if (recipients.length === 0) return;

  const userIds = recipients.map((r) => r.id);
  const emailRecipients = recipients.filter((r) => r.receiveEmailNotifications);

  const lineLinked = await prisma.user.findMany({
    where: { id: { in: userIds }, lineUserId: { not: null } },
    select: { lineUserId: true },
  });

  await Promise.allSettled([
    sendNotificationEmails(emailRecipients, email.subject, email.html),
    sendPushToUsers(userIds, push),
    sendLineMessages(
      lineLinked.map((u) => u.lineUserId as string),
      lineText
    ),
  ]);
}
