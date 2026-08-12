import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import AppShell from "@/components/AppShell";
import { formatCategories } from "@/lib/categories";

const PLACEHOLDER_CARDS = [
  {
    title: "スケジュール・出欠",
    description: "カテゴリーごとの練習・試合予定と出欠確認",
  },
  {
    title: "メッセージ",
    description: "トップ / サテライト / U18 / 全体チャンネル",
  },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell user={user}>
      <div className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row">
        {user.cardImagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.cardImagePath}
            alt="選手証"
            width={160}
            height={200}
            className="mx-auto rounded-md object-cover sm:mx-0"
          />
        ) : (
          <div className="mx-auto flex h-[200px] w-[160px] shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-center text-xs text-gray-400 sm:mx-0">
            選手証
            <br />
            未アップロード
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">マイプロフィール</h2>
          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
            <dt className="text-gray-500">名前</dt>
            <dd className="col-span-1 sm:col-span-3">{user.name}</dd>
            <dt className="text-gray-500">カテゴリー</dt>
            <dd className="col-span-1 sm:col-span-3">
              {formatCategories(user.categories.map((c) => c.category))}
            </dd>
            <dt className="text-gray-500">背番号</dt>
            <dd className="col-span-1 sm:col-span-3">
              {user.uniformNumber ?? "未設定"}
            </dd>
            <dt className="text-gray-500">メール</dt>
            <dd className="col-span-1 sm:col-span-3">{user.email}</dd>
          </dl>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-bold text-gray-900">機能一覧</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {PLACEHOLDER_CARDS.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-dashed border-gray-300 bg-white p-5"
          >
            <h3 className="font-semibold text-gray-900">{card.title}</h3>
            <p className="mt-1 text-sm text-gray-500">{card.description}</p>
            <span className="mt-3 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              Coming soon
            </span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
