import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";
import DashboardTabs from "./DashboardTabs";

export default async function CoachDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/coach/login");
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, invite_code")
    .eq("owner_user_id", user.id)
    .single();

  if (!team) {
    redirect("/coach/setup");
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{team.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            選手への招待コード：
            <span className="font-mono font-semibold">{team.invite_code}</span>
          </p>
        </div>
        <SignOutButton />
      </div>

      <DashboardTabs />

      {children}
    </div>
  );
}
