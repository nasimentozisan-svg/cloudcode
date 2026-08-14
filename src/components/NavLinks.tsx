"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  hasBadge?: boolean;
};

// Highlights whichever link matches the current page (so tapping feels
// like it "landed" somewhere) and shows a small dot when there's something
// new to look at (unread messages, unanswered schedule).
export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  // Pick the single best (longest) matching href rather than letting every
  // prefix match independently - otherwise "/admin" would light up
  // alongside "/admin/cards" while on the cards page.
  const matches = items.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  const activeHref = matches.reduce<string | null>(
    (best, item) => (best === null || item.href.length > best.length ? item.href : best),
    null
  );

  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative whitespace-nowrap rounded-md px-2 py-1 transition-colors active:bg-emerald-100 ${
              active
                ? "bg-emerald-50 font-semibold text-emerald-700"
                : "text-gray-600 hover:text-emerald-600"
            }`}
          >
            {item.label}
            {item.hasBadge && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
