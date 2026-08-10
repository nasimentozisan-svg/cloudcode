import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteObject } from "@/lib/r2";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();

  if (!team) {
    return NextResponse.json({ error: "team not found" }, { status: 404 });
  }

  const { data: video } = await supabase
    .from("videos")
    .select("id, r2_key")
    .eq("id", id)
    .eq("team_id", team.id)
    .maybeSingle();

  if (!video) {
    return NextResponse.json({ error: "video not found" }, { status: 404 });
  }

  await deleteObject(video.r2_key);

  const { error } = await supabase.from("videos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
