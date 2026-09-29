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

  const [emailResult, pushResult, lineResults] = await Promise.allSettled([
    sendNotificationEmails(emailRecipients, email.subject, email.html),
    sendPushToUsers(userIds, push),
    sendLineMessages(
      lineLinked.map((u) => u.lineUserId as string),
      lineText
    ),
  ]);

  // Nothing here identifies which user succeeded or failed (that would mean
  // logging lineUserId, which counts as personal data) - just enough to see
  // in Vercel logs whether LINE delivery is actually working, and to notice
  // "target N, linked M" gaps (people who should be notified but never
  // finished linking their LINE account).
  if (emailResult.status === "fulfilled" && emailResult.value.target > 0) {
    const e = emailResult.value;
    const reasons = Object.entries(e.failures).map(([reason, n]) => `${reason}:${n}`).join(",");
    console.log(
      `[notify] email: provider=${e.provider} target=${e.target} sent=${e.sent} failed=${e.target - e.sent}${reasons ? ` (${reasons})` : ""}`
    );
  } else if (emailResult.status === "rejected") {
    console.error("[notify] email: send threw", emailResult.reason);
  }

  if (pushResult.status === "fulfilled" && pushResult.value.subscriptions > 0) {
    const p = pushResult.value;
    console.log(
      `[notify] push: target=${recipients.length} devices=${p.subscriptions} sent=${p.sent} expired=${p.expired} failed=${p.failed}`
    );
  }

  const results = lineResults.status === "fulfilled" ? lineResults.value : [];
  const succeeded = results.filter((r) => r.ok).length;
  const failureCounts = new Map<string, number>();
  for (const r of results) {
    if (!r.ok) failureCounts.set(r.reason, (failureCounts.get(r.reason) ?? 0) + 1);
  }
  const failureSummary = [...failureCounts].map(([reason, n]) => `${reason}:${n}`).join(",");
  console.log(
    `[notify] LINE: target=${recipients.length} linked=${lineLinked.length} succeeded=${succeeded} failed=${lineLinked.length - succeeded}${failureSummary ? ` (${failureSummary})` : ""}`
  );
  if (failureCounts.has("quota_exceeded")) {
    console.error(
      "[notify] LINE monthly message limit reached - notifications will not be delivered until the LINE plan resets or is upgraded"
    );
  }
}
