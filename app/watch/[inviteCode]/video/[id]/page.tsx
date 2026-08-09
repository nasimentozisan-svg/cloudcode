import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createDownloadUrl } from "@/lib/r2";
import { CATEGORY_LABELS, isVideoCategory } from "@/lib/categories";

export default async function WatchVideoPage({
  params,
}: {
  params: Promise<{ inviteCode: string; id: string }>;
}) {
  const { inviteCode, id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (!team) notFound();

  const { data: video } = await supabase
    .from("videos")
    .select("id, title, description, category, r2_key")
    .eq("id", id)
    .eq("team_id", team.id)
    .eq("status", "ready")
    .maybeSingle();

  if (!video) notFound();

  const videoUrl = await createDownloadUrl(video.r2_key);
  const category = isVideoCategory(video.category) ? video.category : null;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href={`/watch/${inviteCode}/${video.category}`}
        className="text-sm text-slate-500 underline"
      >
        ← {category ? CATEGORY_LABELS[category] : "一覧"}に戻る
      </Link>

      <h1 className="mt-2 text-xl font-bold">{video.title}</h1>
      {video.description && (
        <p className="mt-2 whitespace-pre-wrap text-slate-600">
          {video.description}
        </p>
      )}

      <video
        controls
        playsInline
        className="mt-4 w-full rounded-lg bg-black"
        src={videoUrl}
      />
    </div>
  );
}
