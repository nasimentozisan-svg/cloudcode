"use client";

import { logoutAction } from "@/lib/actions/auth";
import { unsubscribePushAction } from "@/lib/actions/push";

// Stops this device's push notifications before the session ends -
// otherwise a shared phone keeps receiving the logged-out member's
// notifications. Never blocks logout for more than a moment.
async function removeThisDevicePush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await unsubscribePushAction(sub.endpoint);
  await sub.unsubscribe();
}

export default function LogoutButton() {
  return (
    <form
      action={async () => {
        await Promise.race([
          removeThisDevicePush().catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
        await logoutAction();
      }}
    >
      <button className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100">
        ログアウト
      </button>
    </form>
  );
}
