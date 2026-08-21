import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { exchangeCodeForRefreshToken } from "@/lib/google-calendar";
import { escapeHtml } from "@/lib/email";

function htmlPage(bodyHtml: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Googleカレンダー連携</title></head>
    <body style="font-family:sans-serif;max-width:560px;margin:40px auto;padding:0 16px;line-height:1.7;">
    ${bodyHtml}
    </body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

// Google redirects here after the admin approves (or cancels) access on
// the consent screen started by ../route.ts. On success this is the ONLY
// place the refresh token is ever visible - it's shown once so the admin
// can copy it into Vercel's env vars; the app itself never stores it.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const error = req.nextUrl.searchParams.get("error");
  if (error) {
    return htmlPage(`<p>Google側で許可がキャンセルされました（${escapeHtml(error)}）。もう一度お試しください。</p>`);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return htmlPage(`<p>コードが見つかりませんでした。もう一度お試しください。</p>`);
  }

  try {
    const refreshToken = await exchangeCodeForRefreshToken(code);
    return htmlPage(`
      <h1 style="font-size:18px;">連携が完了しました</h1>
      <p>下のコードをコピーして、Vercelの環境変数
      <code>GOOGLE_OAUTH_REFRESH_TOKEN</code> に貼り付けてください。</p>
      <textarea readonly style="width:100%;height:90px;font-size:14px;padding:8px;" onclick="this.select()">${escapeHtml(refreshToken)}</textarea>
      <p>貼り付けたら「Redeploy（再デプロイ）」すれば、毎日8時の自動同期が有効になります。</p>
      <p style="color:#666;font-size:13px;">このコードは今だけ表示されます。閉じたら二度と表示されないので、必ず今コピーしてください。</p>
    `);
  } catch (e) {
    return htmlPage(`<p>エラーが発生しました: ${escapeHtml(e instanceof Error ? e.message : "不明なエラー")}</p>`);
  }
}
