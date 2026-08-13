"use client";

import { useEffect, useState, useTransition } from "react";
import { subscribePushAction, unsubscribePushAction } from "@/lib/actions/push";

type Status = "checking" | "unsupported" | "off" | "on";

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

  useEffect(() => {
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
      .catch(() => setStatus("unsupported"));
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

  if (status === "unsupported") {
    return <p className="text-xs text-gray-400">この端末・ブラウザはプッシュ通知に対応していません</p>;
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
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
