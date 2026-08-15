"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/coach/dashboard", label: "戦術ボード" },
  { href: "/coach/dashboard/match", label: "試合フィードバック" },
];

export default function DashboardTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-2 border-b border-slate-200">
      {TABS.map((tab) => {
        const active =
          tab.href === "/coach/dashboard"
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              active
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
