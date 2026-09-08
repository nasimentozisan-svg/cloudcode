import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

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
export async function handleEvent(event: LineEvent): Promise<void> {
  if (event.type !== "message" || event.message?.type !== "text") return;
  const text = event.message.text?.trim();
  const lineUserId = event.source?.userId;
  if (!text || !lineUserId) return;

  // Codes are always generated upper-case (generateLineLinkCodeAction); a
  // phone keyboard auto-capitalizing differently, or someone retyping it by
  // hand in lower-case, would otherwise fail the lookup with no clue why.
  const code = text.toUpperCase();

  const user = await prisma.user.findUnique({ where: { lineLinkCode: code } });
  if (!user) {
    if (event.replyToken) {
      await reply(event.replyToken, "連携コードが見つかりませんでした。マイページに表示されているコードを確認してください。");
    }
    return;
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lineUserId, lineLinkCode: null },
    });
  } catch (error) {
    // lineUserId is unique per app account - this LINE account is already
    // linked to a DIFFERENT EFK members account (e.g. a family sharing one
    // phone/LINE account across siblings' accounts). Previously this threw
    // uncaught, so the sender got no reply and silently never linked -
    // exactly the kind of "some people just don't get notified" gap this
    // was investigating.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      if (event.replyToken) {
        await reply(
          event.replyToken,
          "このLINEアカウントは既に別のメンバーズアカウントと連携されています。1つのLINEアカウントは1つのメンバーズアカウントにしか連携できません。別のLINEアカウント（別の端末など）で連携するか、管理者にご相談ください。"
        );
      }
      return;
    }
    throw error;
  }

  if (event.replyToken) {
    await reply(event.replyToken, `${user.name}さんのアカウントと連携しました。今後LINEで通知が届きます。`);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: LineEvent[] };
  for (const event of body.events ?? []) {
    // One bad event must never take down the rest of the batch (LINE can
    // pack several events into one webhook call) or leave the sender with
    // no reply at all - both silently masked a real linking failure before.
    try {
      await handleEvent(event);
    } catch (error) {
      console.error("LINE webhook event failed", event.type, error);
      if (event.replyToken) {
        await reply(event.replyToken, "エラーが発生しました。時間をおいてもう一度お試しいただくか、管理者にご連絡ください。");
      }
    }
  }

  return NextResponse.json({ ok: true });
}
