import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createUploadUrl } from "@/lib/r2";

export async function POST(request: Request) {
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

  const { fileName, contentType } = await request.json();
  if (!fileName || !contentType) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const key = `teams/${team.id}/${randomUUID()}-${fileName}`;
  const uploadUrl = await createUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key });
}
