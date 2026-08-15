import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createDownloadUrl } from "@/lib/r2";
import { TEAM_CATEGORY_LABELS, isTeamCategory } from "@/lib/categories";
import SwipeViewer from "./SwipeViewer";

export default async function MatchFolderViewerPage({
  params,
}: {
  params: Promise<{ inviteCode: string; folderId: string }>;
}) {
  const { inviteCode, folderId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (!team) notFound();

  const { data: folder } = await supabase
    .from("match_folders")
    .select("id, team_category, opponent, created_at")
    .eq("id", folderId)
    .eq("team_id", team.id)
    .maybeSingle();

  if (!folder) notFound();

  const { data: videos } = await supabase
    .from("match_videos")
    .select("id, r2_key")
    .eq("match_folder_id", folderId)
    .order("sort_order", { ascending: true });

  if (!videos || videos.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Link href={`/watch/${inviteCode}/matches`} className="text-sm text-slate-500 underline">
          ← フォルダ一覧に戻る
        </Link>
        <p className="mt-4 text-sm text-slate-400">まだ動画がありません</p>
      </div>
    );
  }

  const videoUrls = await Promise.all(
    videos.map((v) => createDownloadUrl(v.r2_key))
  );

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href={`/watch/${inviteCode}/matches`} className="text-sm text-slate-500 underline">
        ← フォルダ一覧に戻る
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-bold">
        {isTeamCategory(folder.team_category)
          ? TEAM_CATEGORY_LABELS[folder.team_category]
          : folder.team_category}{" "}
        vs {folder.opponent}
      </h1>

      <SwipeViewer videoUrls={videoUrls} />
    </div>
  );
}
