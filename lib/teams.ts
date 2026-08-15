import type { SupabaseClient } from "@supabase/supabase-js";

export async function getTeamByInviteCode(
  supabase: SupabaseClient,
  inviteCode: string
) {
  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  return team;
}
