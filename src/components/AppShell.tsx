import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { CATEGORY_LABELS } from "@/lib/categories";
import type { User } from "@/generated/prisma/client";

export default function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold text-gray-900">⚽ Futsal Club</span>
            <nav className="flex gap-4 text-sm text-gray-600">
              <Link href="/dashboard" className="hover:text-emerald-600">
                ホーム
              </Link>
              {user.isAdmin && (
                <Link href="/admin" className="hover:text-emerald-600">
                  管理者
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>
              {user.name}（{CATEGORY_LABELS[user.category]}
              {user.isAdmin ? " / 管理者" : ""}）
            </span>
            <form action={logoutAction}>
              <button className="rounded-md border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100">
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
