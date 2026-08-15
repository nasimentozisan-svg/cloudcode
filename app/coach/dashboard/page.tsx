import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, VIDEO_CATEGORIES, type VideoCategory } from "@/lib/categories";
import UploadForm from "./UploadForm";
import DeleteVideoButton from "./DeleteVideoButton";

export default async function CoachDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/coach/login");
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, invite_code")
    .eq("owner_user_id", user.id)
    .single();

  if (!team) {
    redirect("/coach/setup");
  }

  const { data: videos } = await supabase
    .from("videos")
    .select("id, title, description, category, created_at")
    .eq("team_id", team.id)
    .order("created_at", { ascending: false });

  const videosByCategory = new Map<VideoCategory, typeof videos>();
  for (const c of VIDEO_CATEGORIES) {
    videosByCategory.set(
      c,
      (videos ?? []).filter((v) => v.category === c)
    );
  }

  return (
    <div>
      <div className="mb-8">
        <UploadForm teamId={team.id} />
      </div>

      <div className="space-y-6">
        {VIDEO_CATEGORIES.map((category) => {
          const list = videosByCategory.get(category) ?? [];
          return (
            <div key={category}>
              <h2 className="mb-2 font-semibold text-slate-700">
                {CATEGORY_LABELS[category]}（{list.length}本）
              </h2>
              {list.length === 0 ? (
                <p className="text-sm text-slate-400">まだ動画がありません</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-3"
                    >
                      <Link
                        href={`/watch/${team.invite_code}/board/video/${v.id}`}
                        className="min-w-0 flex-1 hover:opacity-70"
                      >
                        <p className="font-medium">{v.title}</p>
                        {v.description && (
                          <p className="mt-1 text-sm text-slate-500">
                            {v.description}
                          </p>
                        )}
                      </Link>
                      <DeleteVideoButton videoId={v.id} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
