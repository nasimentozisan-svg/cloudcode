import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedCoachTeam } from "@/lib/coach";
import { deleteMatchFolder } from "@/lib/match-feedback";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { team, error } = await getAuthenticatedCoachTeam(supabase);

  if (!team) {
    return NextResponse.json(
      { error },
      { status: error === "unauthorized" ? 401 : 404 }
    );
  }

  const { data: folder } = await supabase
    .from("match_folders")
    .select("id")
    .eq("id", id)
    .eq("team_id", team.id)
    .maybeSingle();

  if (!folder) {
    return NextResponse.json({ error: "folder not found" }, { status: 404 });
  }

  await deleteMatchFolder(supabase, id);

  return NextResponse.json({ ok: true });
}
