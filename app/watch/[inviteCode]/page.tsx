import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTeamByInviteCode } from "@/lib/teams";
import InviteCodeNotFound from "../InviteCodeNotFound";

export default async function TeamTopPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  const supabase = await createSupabaseServerClient();
  const team = await getTeamByInviteCode(supabase, inviteCode);

  if (!team) return <InviteCodeNotFound />;

  return (
    <div className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="mb-8 text-center text-xl font-bold">{team.name}</h1>
      <div className="space-y-3">
        <Link
          href={`/watch/${inviteCode}/board`}
          className="block rounded-lg border border-slate-200 bg-white px-4 py-6 text-center hover:bg-slate-50"
        >
          <p className="font-semibold">戦術ボード</p>
          <p className="mt-1 text-sm text-slate-500">局面別の戦術動画</p>
        </Link>
        <Link
          href={`/watch/${inviteCode}/matches`}
          className="block rounded-lg border border-slate-200 bg-white px-4 py-6 text-center hover:bg-slate-50"
        >
          <p className="font-semibold">試合フィードバック</p>
          <p className="mt-1 text-sm text-slate-500">試合ごとの振り返り動画</p>
        </Link>
      </div>
    </div>
  );
}
