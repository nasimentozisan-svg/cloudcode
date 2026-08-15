import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEAM_CATEGORY_LABELS, isTeamCategory } from "@/lib/categories";
import MatchUploadForm from "./MatchUploadForm";
import DeleteMatchFolderButton from "./DeleteMatchFolderButton";

export default async function MatchFolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: folder } = await supabase
    .from("match_folders")
    .select("id, team_category, opponent, created_at")
    .eq("id", id)
    .eq("team_id", team.id)
    .maybeSingle();

  if (!folder) notFound();

  const { data: videos } = await supabase
    .from("match_videos")
    .select("id, sort_order")
    .eq("match_folder_id", id)
    .order("sort_order", { ascending: true });

  return (
    <div>
      <Link href="/coach/dashboard/match" className="text-sm text-slate-500 underline">
        ← フォルダ一覧に戻る
      </Link>

      <div className="mt-2 mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold">
            {isTeamCategory(folder.team_category)
              ? TEAM_CATEGORY_LABELS[folder.team_category]
              : folder.team_category}{" "}
            vs {folder.opponent}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(folder.created_at).toLocaleDateString("ja-JP")}・
            {videos?.length ?? 0}本
          </p>
        </div>
        <DeleteMatchFolderButton folderId={folder.id} />
      </div>

      <div className="mb-6">
        <MatchUploadForm
          matchFolderId={folder.id}
          startSortOrder={videos?.length ?? 0}
        />
      </div>

      {!videos || videos.length === 0 ? (
        <p className="text-sm text-slate-400">まだ動画がありません</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {videos.map((v, i) => (
            <div
              key={v.id}
              className="flex aspect-square items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-500"
            >
              {i + 1}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
