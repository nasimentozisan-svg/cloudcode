import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { buildGoogleAuthUrl } from "@/lib/google-calendar";

// One-time step an admin runs manually to let this app create events on
// the club's Google account: redirects to Google's consent screen, then
// /callback below exchanges the result for a long-lived refresh token.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  let url: string;
  try {
    url = buildGoogleAuthUrl();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "設定エラー" },
      { status: 500 }
    );
  }
  return NextResponse.redirect(url);
}
