import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEAM_CATEGORY_LABELS, isTeamCategory } from "@/lib/categories";
import CreateMatchFolderForm from "./CreateMatchFolderForm";

export default async function MatchFeedbackPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/coach/login");
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();

  if (!team) {
    redirect("/coach/setup");
  }

  const { data: folders } = await supabase
    .from("match_folders")
    .select("id, team_category, opponent, created_at, match_videos(count)")
    .eq("team_id", team.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-8">
        <CreateMatchFolderForm />
      </div>

      <p className="mb-2 text-sm text-slate-500">
        アップロードから2週間経過したフォルダは自動的に削除されます
      </p>

      {!folders || folders.length === 0 ? (
        <p className="text-sm text-slate-400">まだフォルダがありません</p>
      ) : (
        <ul className="space-y-2">
          {folders.map((f) => (
            <li key={f.id}>
              <Link
                href={`/coach/dashboard/match/${f.id}`}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3 hover:bg-slate-50"
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
