import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteMatchFolder } from "@/lib/match-feedback";

const RETENTION_DAYS = 14;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: expiredFolders } = await supabase
    .from("match_folders")
    .select("id")
    .lt("created_at", cutoff);

  for (const folder of expiredFolders ?? []) {
    await deleteMatchFolder(supabase, folder.id);
  }

  return NextResponse.json({ deleted: expiredFolders?.length ?? 0 });
}
