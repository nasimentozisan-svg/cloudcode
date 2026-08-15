import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteObjects } from "@/lib/r2";

export async function deleteMatchFolder(
  supabase: SupabaseClient,
  folderId: string
) {
  const { data: videos } = await supabase
    .from("match_videos")
    .select("r2_key")
    .eq("match_folder_id", folderId);

  if (videos && videos.length > 0) {
    await deleteObjects(videos.map((v) => v.r2_key));
  }

  await supabase.from("match_folders").delete().eq("id", folderId);
}
