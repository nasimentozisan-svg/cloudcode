"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateNotificationPrefAction } from "@/lib/actions/profile";

export default function EmailNotificationToggle({
  initialValue,
}: {
  initialValue: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(initialValue);

  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.checked;
          setChecked(next);
          startTransition(async () => {
            await updateNotificationPrefAction(next);
            router.refresh();
          });
        }}
      />
      新しい予定・自分宛のメンションをメールで通知する
    </label>
  );
}
