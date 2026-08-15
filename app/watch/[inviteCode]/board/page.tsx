import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTeamByInviteCode } from "@/lib/teams";
import { CATEGORY_LABELS, VIDEO_CATEGORIES } from "@/lib/categories";
import InviteCodeNotFound from "../../InviteCodeNotFound";

export default async function BoardFoldersPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  const supabase = await createSupabaseServerClient();
  const team = await getTeamByInviteCode(supabase, inviteCode);

  if (!team) return <InviteCodeNotFound />;

  const { data: videos } = await supabase
    .from("videos")
    .select("category")
    .eq("team_id", team.id)
    .eq("status", "ready");

  const counts = new Map<string, number>();
  for (const v of videos ?? []) {
    counts.set(v.category, (counts.get(v.category) ?? 0) + 1);
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href={`/watch/${inviteCode}`} className="text-sm text-slate-500 underline">
        ← 戻る
      </Link>
      <h1 className="mt-2 mb-6 text-xl font-bold">戦術ボード</h1>
      <ul className="space-y-3">
        {VIDEO_CATEGORIES.map((category) => (
          <li key={category}>
            <Link
              href={`/watch/${inviteCode}/board/${category}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-4 hover:bg-slate-50"
            >
              <span className="font-medium">{CATEGORY_LABELS[category]}</span>
              <span className="text-sm text-slate-400">
                {counts.get(category) ?? 0}本
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
