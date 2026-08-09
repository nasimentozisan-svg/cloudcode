import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, VIDEO_CATEGORIES } from "@/lib/categories";

export default async function TeamFoldersPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (!team) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <div>
          <p className="text-lg font-semibold">招待コードが見つかりません</p>
          <Link href="/watch" className="mt-4 inline-block text-sm underline">
            コードを入力し直す
          </Link>
        </div>
      </div>
    );
  }

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
      <h1 className="mb-6 text-xl font-bold">{team.name}</h1>
      <ul className="space-y-3">
        {VIDEO_CATEGORIES.map((category) => (
          <li key={category}>
            <Link
              href={`/watch/${inviteCode}/${category}`}
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
