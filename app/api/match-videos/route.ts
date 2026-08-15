import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedCoachTeam } from "@/lib/coach";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { team, error } = await getAuthenticatedCoachTeam(supabase);

  if (!team) {
    return NextResponse.json(
      { error },
      { status: error === "unauthorized" ? 401 : 404 }
    );
  }

  const { matchFolderId, r2Key, sortOrder } = await request.json();
  if (!matchFolderId || !r2Key || typeof sortOrder !== "number") {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { data: folder } = await supabase
    .from("match_folders")
    .select("id")
    .eq("id", matchFolderId)
    .eq("team_id", team.id)
    .maybeSingle();

  if (!folder) {
    return NextResponse.json({ error: "folder not found" }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("match_videos").insert({
    match_folder_id: matchFolderId,
    r2_key: r2Key,
    sort_order: sortOrder,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
