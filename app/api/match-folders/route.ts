import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedCoachTeam } from "@/lib/coach";
import { isTeamCategory } from "@/lib/categories";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { team, error } = await getAuthenticatedCoachTeam(supabase);

  if (!team) {
    return NextResponse.json(
      { error },
      { status: error === "unauthorized" ? 401 : 404 }
    );
  }

  const { teamCategory, opponent } = await request.json();
  if (!teamCategory || !isTeamCategory(teamCategory) || !opponent) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { data: folder, error: insertError } = await supabase
    .from("match_folders")
    .insert({ team_id: team.id, team_category: teamCategory, opponent })
    .select("id")
    .single();

  if (insertError || !folder) {
    return NextResponse.json(
      { error: insertError?.message ?? "failed to create folder" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: folder.id });
}
