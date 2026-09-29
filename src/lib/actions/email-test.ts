"use server";

import { requireAdmin } from "@/lib/require-admin";
import { getGoogleGrantStatus, isGoogleSyncConfigured } from "@/lib/google-calendar";
import { sendEmailsVia } from "@/lib/email";

export type GmailStatus =
  | { state: "not_configured" }
  | { state: "ok"; calendar: boolean; gmailSend: boolean }
  | { state: "error"; message: string };

export async function getGmailStatusAction(): Promise<GmailStatus> {
  await requireAdmin();
  if (!isGoogleSyncConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", ...(await getGoogleGrantStatus()) };
  } catch (e) {
    return { state: "error", message: e instanceof Error ? e.message : "確認に失敗しました" };
  }
}

// One email, via Gmail, to the logged-in admin's own address only -
// independent of EMAIL_PROVIDER, so nobody else gets mail during the test.
export async function sendTestEmailAction(): Promise<
  { state: "sent" } | { state: "no_permission" } | { state: "failed"; reason: string }
> {
  const admin = await requireAdmin();
  const status = await getGmailStatusAction();
  if (status.state !== "ok" || !status.gmailSend) return { state: "no_permission" };

  const summary = await sendEmailsVia(
    "gmail",
    [{ email: admin.email }],
    "【EFK members】メール送信テスト",
    `<p>EFK members からのテストメールです。</p>
    <p>このメールが届いていれば、クラブのGmailからの通知メール送信は正常に動いています。</p>
    <p style="color:#666;font-size:12px;">このメールは管理者画面の「テストメールを送る」から、送信した管理者本人にだけ送られています。</p>`
  );
  const reasons = Object.entries(summary.failures).map(([r, n]) => `${r}:${n}`).join(",");
  // No address in the log - just the outcome.
  console.log(`[email-test] provider=gmail sent=${summary.sent} failed=${summary.target - summary.sent}${reasons ? ` (${reasons})` : ""}`);
  return summary.sent === 1 ? { state: "sent" } : { state: "failed", reason: reasons || "unknown" };
}
