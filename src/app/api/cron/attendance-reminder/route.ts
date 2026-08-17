import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canRespondToEvent } from "@/lib/schedule-permissions";
import { notifyRecipients } from "@/lib/notify";
import { escapeHtml } from "@/lib/email";
import { formatJST } from "@/lib/datetime";
import type { Category } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const REMINDER_WINDOW_MS = 48 * 60 * 60 * 1000;

// Triggered daily by Vercel Cron (see vercel.json). Nags anyone eligible to
// respond to an event starting within the next 48h who hasn't answered yet -
// since this runs once a day, an unanswered event gets caught by two
// consecutive runs (~2 days out, then ~1 day out) before it happens.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const events = await prisma.event.findMany({
    where: { startAt: { gte: now, lte: windowEnd } },
    include: { categories: true, responses: true },
  });
  if (events.length === 0) {
    return NextResponse.json({ ok: true, reminded: 0 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      receiveEmailNotifications: true,
      categories: { select: { category: true } },
    },
  });

  const unansweredByUser = new Map<string, typeof events>();
  for (const ev of events) {
    const eventCategories = ev.categories.map((c) => c.category);
    for (const u of users) {
      const userCategories = u.categories.map((c) => c.category as Category);
      if (!canRespondToEvent(userCategories, eventCategories)) continue;
      if (ev.responses.some((r) => r.userId === u.id)) continue;
      const list = unansweredByUser.get(u.id) ?? [];
      list.push(ev);
      unansweredByUser.set(u.id, list);
    }
  }

  for (const [userId, unanswered] of unansweredByUser) {
    const user = users.find((u) => u.id === userId)!;
    const dateLabel = (startAt: Date) =>
      formatJST(startAt, { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });

    await notifyRecipients(
      [user],
      {
        subject: `【EFK members】出欠未回答の予定が${unanswered.length}件あります`,
        html: `<p>以下の予定の出欠がまだ未回答です。</p>
        <ul>${unanswered.map((e) => `<li>${escapeHtml(e.title)} - ${dateLabel(e.startAt)}</li>`).join("")}</ul>
        ${APP_URL ? `<p><a href="${APP_URL}/schedule">スケジュールで回答する</a></p>` : ""}`,
      },
      {
        title: "出欠未回答のお知らせ",
        body: `${unanswered.length}件の予定が出欠未回答です`,
        url: "/schedule",
      },
      `【EFK members】出欠未回答の予定があります\n${unanswered.map((e) => `・${e.title} (${dateLabel(e.startAt)})`).join("\n")}`
    );
  }

  return NextResponse.json({ ok: true, reminded: unansweredByUser.size });
}
