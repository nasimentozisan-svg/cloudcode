import { NextRequest, NextResponse } from "next/server";
import { del } from "@/lib/blob";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Triggered daily by Vercel Cron (see vercel.json). Deletes the blob for
// any attachment past its retention window, but keeps the message itself -
// only the file and its metadata are cleared.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expired = await prisma.message.findMany({
    where: { attachmentPath: { not: null }, attachmentExpiresAt: { lte: new Date() } },
    select: { id: true, attachmentPath: true },
  });

  await Promise.allSettled(
    expired.map((m) => del(m.attachmentPath!).catch(() => {}))
  );

  await prisma.message.updateMany({
    where: { id: { in: expired.map((m) => m.id) } },
    data: { attachmentPath: null, attachmentName: null, attachmentExpiresAt: null },
  });

  return NextResponse.json({ ok: true, cleaned: expired.length });
}
