import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
};

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("SHA256", secret).update(rawBody).digest("base64");
  return expected === signature;
}

async function reply(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  }).catch(() => {});
}

// Account linking without full LINE Login: the user generates a short code
// on their mypage (generateLineLinkCodeAction) and sends it as a plain
// message to the club's LINE Official Account. Whichever LINE user sends a
// message matching an outstanding code gets that code's account linked.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: LineEvent[] };
  for (const event of body.events ?? []) {
    if (event.type !== "message" || event.message?.type !== "text") continue;
    const text = event.message.text?.trim();
    const lineUserId = event.source?.userId;
    if (!text || !lineUserId) continue;

    const user = await prisma.user.findUnique({ where: { lineLinkCode: text } });
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lineUserId, lineLinkCode: null },
      });
      if (event.replyToken) {
        await reply(event.replyToken, `${user.name}さんのアカウントと連携しました。今後LINEで通知が届きます。`);
      }
    } else if (event.replyToken) {
      await reply(event.replyToken, "連携コードが見つかりませんでした。マイページに表示されているコードを確認してください。");
    }
  }

  return NextResponse.json({ ok: true });
}
