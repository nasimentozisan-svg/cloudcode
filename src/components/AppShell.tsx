import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { formatCategories } from "@/lib/categories";
import type { User, UserCategory } from "@/generated/prisma/client";

export default function AppShell({
  user,
  children,
}: {
  user: User & { categories: UserCategory[] };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="EFK members"
                width={40}
                height={40}
                className="rounded-full"
              />
              <span className="font-bold text-gray-900">EFK members</span>
            </Link>
            <nav className="flex gap-4 text-sm text-gray-600">
              <Link href="/dashboard" className="hover:text-emerald-600">
                ホーム
              </Link>
              <Link href="/schedule" className="hover:text-emerald-600">
                スケジュール
              </Link>
              {user.isAdmin && (
                <>
                  <Link href="/admin" className="hover:text-emerald-600">
                    管理者
                  </Link>
                  <Link href="/admin/cards" className="hover:text-emerald-600">
                    選手証
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>
              {user.name}（{formatCategories(user.categories.map((c) => c.category))}
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
