import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedCoachTeam } from "@/lib/coach";
import { createUploadUrl } from "@/lib/r2";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { team, error } = await getAuthenticatedCoachTeam(supabase);

  if (!team) {
    return NextResponse.json(
      { error },
      { status: error === "unauthorized" ? 401 : 404 }
    );
  }

  const { matchFolderId, fileName, contentType } = await request.json();
  if (!matchFolderId || !fileName || !contentType) {
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

  const key = `teams/${team.id}/match/${matchFolderId}/${randomUUID()}-${fileName}`;
  const uploadUrl = await createUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key });
}
