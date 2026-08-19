import { NextRequest, NextResponse } from "next/server";
import { del } from "@/lib/blob";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Triggered daily by Vercel Cron (see vercel.json). Deletes the blob for
// any attachment past its retention window, but keeps the message itself -
// only the attachment rows are removed.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expired = await prisma.messageAttachment.findMany({
    where: { expiresAt: { lte: new Date() } },
    select: { id: true, path: true },
  });

  await Promise.allSettled(expired.map((a) => del(a.path).catch(() => {})));

  await prisma.messageAttachment.deleteMany({
    where: { id: { in: expired.map((a) => a.id) } },
  });

  return NextResponse.json({ ok: true, cleaned: expired.length });
}
