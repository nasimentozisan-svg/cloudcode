import type { SupabaseClient } from "@supabase/supabase-js";

export async function getAuthenticatedCoachTeam(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { team: null, error: "unauthorized" as const };

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();

  if (!team) return { team: null, error: "team_not_found" as const };

  return { team, error: null };
}
