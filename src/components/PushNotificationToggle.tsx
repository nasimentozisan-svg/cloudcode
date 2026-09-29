"use client";

import { useEffect, useState, useTransition } from "react";
import { sendTestPushAction, subscribePushAction, unsubscribePushAction } from "@/lib/actions/push";

type Status = "checking" | "unsupported" | "ios-needs-home-screen" | "register-error" | "off" | "on";

// iPhone/iPad Safari only offers web push to sites added to the Home Screen
// (iOS 16.4+) and opened from there; in a normal Safari tab PushManager
// simply doesn't exist, which used to read as "not supported" with no hint.
function isIosBrowserTab(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes.buffer;
}

export default function PushNotificationToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [testMessage, setTestMessage] = useState<string | null>(null);

  useEffect(() => {
    if (vapidPublicKey && isIosBrowserTab()) {
      setStatus("ios-needs-home-screen");
      return;
    }
    if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "on" : "off");
      })
      .catch((e) => {
        setStatus("register-error");
        setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      });
  }, [vapidPublicKey]);

  function enable() {
    if (!vapidPublicKey) return;
    setError(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError("通知が許可されませんでした。ブラウザの設定から許可してください");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          throw new Error("購読情報の取得に失敗しました");
        }
        await subscribePushAction({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        });
        setStatus("on");
      } catch (e) {
        setError(e instanceof Error ? e.message : "通知の有効化に失敗しました");
      }
    });
  }

  function disable() {
    setError(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await unsubscribePushAction(sub.endpoint);
          await sub.unsubscribe();
        }
        setStatus("off");
      } catch (e) {
        setError(e instanceof Error ? e.message : "通知の無効化に失敗しました");
      }
    });
  }

  function sendTest(delaySeconds: 0 | 15) {
    setError(null);
    setTestMessage(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          setStatus("off");
          setTestMessage("この端末は通知が未登録です。もう一度オンにしてください");
          return;
        }
        const result = await sendTestPushAction(sub.endpoint, delaySeconds);
        setTestMessage(
          result === "sent"
            ? "テスト通知を送信しました（この端末のみ）"
            : result === "scheduled"
              ? "15秒後にこの端末だけへ送ります。今のうちにアプリを閉じる／画面を消してください"
              : result === "not_registered"
                ? "この端末は通知が未登録です。もう一度オンにしてください"
                : result === "expired"
                  ? "この端末の通知登録が無効になっていました。もう一度オンにしてください"
                  : "送信に失敗しました"
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "テスト通知の送信に失敗しました");
      }
    });
  }

  if (status === "unsupported") {
    return <p className="text-xs text-gray-400">この端末・ブラウザはプッシュ通知に対応していません</p>;
  }
  if (status === "ios-needs-home-screen") {
    return (
      <p className="text-xs text-gray-600">
        iPhoneでプッシュ通知を受け取るには、Safariの共有ボタン（□↑）→「ホーム画面に追加」でアプリを追加し、ホーム画面のアイコンから開いてこの設定をオンにしてください（iOS 16.4以降）。
      </p>
    );
  }
  if (status === "register-error") {
    return (
      <p className="text-xs text-red-600">
        プッシュ通知の準備でエラーが発生しました: {error}
      </p>
    );
  }
  if (status === "checking") return null;

  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={status === "on"}
          disabled={isPending}
          onChange={(e) => (e.target.checked ? enable() : disable())}
        />
        この端末でプッシュ通知を受け取る
      </label>
      {status === "on" && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => sendTest(0)}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            この端末にテスト通知を送る
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => sendTest(15)}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            15秒後に送る（閉じた状態の確認用）
          </button>
        </div>
      )}
      {testMessage && <p className="mt-1 text-xs text-gray-600">{testMessage}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
