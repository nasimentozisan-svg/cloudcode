import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, isVideoCategory } from "@/lib/categories";

export default async function CategoryVideosPage({
  params,
}: {
  params: Promise<{ inviteCode: string; category: string }>;
}) {
  const { inviteCode, category } = await params;
  if (!isVideoCategory(category)) notFound();

  const supabase = await createSupabaseServerClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (!team) notFound();

  const { data: videos } = await supabase
    .from("videos")
    .select("id, title, description, created_at")
    .eq("team_id", team.id)
    .eq("category", category)
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href={`/watch/${inviteCode}/board`} className="text-sm text-slate-500 underline">
        ← フォルダ一覧に戻る
      </Link>
      <h1 className="mt-2 mb-6 text-xl font-bold">{CATEGORY_LABELS[category]}</h1>

      {!videos || videos.length === 0 ? (
        <p className="text-sm text-slate-400">まだ動画がありません</p>
      ) : (
        <ul className="space-y-3">
          {videos.map((v) => (
            <li key={v.id}>
              <Link
                href={`/watch/${inviteCode}/board/video/${v.id}`}
                className="block rounded-lg border border-slate-200 bg-white px-4 py-4 hover:bg-slate-50"
              >
                <p className="font-medium">{v.title}</p>
                {v.description && (
                  <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                    {v.description}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
