"use client";

import { useState, useTransition } from "react";
import { getGmailStatusAction, sendTestEmailAction, type GmailStatus } from "@/lib/actions/email-test";

export default function GmailTestSection() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function check() {
    setResult(null);
    startTransition(async () => setStatus(await getGmailStatusAction()));
  }

  function sendTest() {
    if (!confirm("あなた（ログイン中の管理者）のメールアドレスにだけ、テストメールを1通送ります。よろしいですか？")) return;
    setResult(null);
    startTransition(async () => {
      const r = await sendTestEmailAction();
      setResult(
        r.state === "sent"
          ? "テストメールを1通送信しました。受信箱（届かない場合は迷惑メールフォルダ）を確認してください。"
          : r.state === "no_permission"
            ? "Gmail送信の許可がまだありません。上の手順で許可してください。"
            : `送信に失敗しました（${r.reason}）`
      );
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <button
        type="button"
        disabled={isPending}
        onClick={check}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        Gmail送信の許可状態を確認する
      </button>

      {status?.state === "not_configured" && (
        <p className="text-gray-700">Google連携が未設定です。</p>
      )}
      {status?.state === "error" && <p className="text-red-600">確認できませんでした: {status.message}</p>}
      {status?.state === "ok" && (
        <div className="space-y-2">
          <p className="text-gray-700">
            カレンダー: {status.calendar ? "許可あり" : "許可なし"} ／ Gmail送信: {status.gmailSend ? "許可あり" : "許可なし"}
          </p>
          {!status.gmailSend && (
            <a
              href="/api/admin/google-calendar-authorize"
              className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
            >
              Gmail送信を許可する（クラブのGoogleアカウントで再認証）
            </a>
          )}
          {status.gmailSend && (
            <button
              type="button"
              disabled={isPending}
              onClick={sendTest}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              自分宛てにテストメールを1通送る
            </button>
          )}
        </div>
      )}
      {result && <p className="text-gray-700">{result}</p>}
    </div>
  );
}
