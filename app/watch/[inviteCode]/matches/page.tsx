import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTeamByInviteCode } from "@/lib/teams";
import { TEAM_CATEGORY_LABELS, isTeamCategory } from "@/lib/categories";
import InviteCodeNotFound from "../../InviteCodeNotFound";

export default async function MatchFeedbackFoldersPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  const supabase = await createSupabaseServerClient();
  const team = await getTeamByInviteCode(supabase, inviteCode);

  if (!team) return <InviteCodeNotFound />;

  const { data: folders } = await supabase
    .from("match_folders")
    .select("id, team_category, opponent, created_at, match_videos(count)")
    .eq("team_id", team.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href={`/watch/${inviteCode}`} className="text-sm text-slate-500 underline">
        ← 戻る
      </Link>
      <h1 className="mt-2 mb-6 text-xl font-bold">試合フィードバック</h1>

      {!folders || folders.length === 0 ? (
        <p className="text-sm text-slate-400">まだ動画がありません</p>
      ) : (
        <ul className="space-y-3">
          {folders.map((f) => (
            <li key={f.id}>
              <Link
                href={`/watch/${inviteCode}/matches/${f.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-4 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium">
                    {isTeamCategory(f.team_category)
                      ? TEAM_CATEGORY_LABELS[f.team_category]
                      : f.team_category}{" "}
                    vs {f.opponent}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {new Date(f.created_at).toLocaleDateString("ja-JP")}
                  </p>
                </div>
                <span className="text-sm text-slate-400">
                  {f.match_videos[0]?.count ?? 0}本
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
