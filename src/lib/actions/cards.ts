"use server";

import { randomUUID } from "node:crypto";
import { put, del, copy } from "@/lib/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { parseRosterPdf } from "@/lib/pdf-roster";
import { findNameMatches } from "@/lib/card-matching";

export type UploadCardsState = {
  matched: number;
  pending: number;
  error?: string;
};

// The roster PDF is uploaded client-side straight to Blob storage first
// (see /api/upload) rather than through this action's own body - Vercel
// serverless functions hard-cap incoming request bodies at 4.5MB regardless
// of app config, and roster PDFs full of player photos routinely exceed
// that. This action just receives the resulting blob URLs, fetches each
// PDF back server-side (outbound fetches aren't subject to that limit),
// processes it, then deletes the temporary upload.
export async function processRosterUploadsAction(
  uploads: { url: string; name: string }[]
): Promise<UploadCardsState> {
  await requireAdmin();

  if (uploads.length === 0) {
    return { matched: 0, pending: 0, error: "PDFファイルを選択してください" };
  }

  const users = await prisma.user.findMany({ select: { id: true, name: true } });

  let matched = 0;
  let pending = 0;
  let failed = 0;

  async function processEntry(entry: Awaited<ReturnType<typeof parseRosterPdf>>[number]) {
    const matches = findNameMatches(entry.name, users);

    if (matches.length === 1) {
      const userId = matches[0].id;
      // Fixed pathname per user, overwritten on every re-upload (mirrors
      // the roster-refresh workflow: latest photo always wins).
      const blob = await put(`cards/${userId}.jpg`, entry.photo, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/jpeg",
      });
      await prisma.user.update({
        where: { id: userId },
        data: {
          cardImagePath: blob.url,
          uniformNumber: entry.uniformNumber,
          registrationNumber: entry.registrationNumber,
          birthDate: entry.birthDate,
        },
      });
      // A name that was unmatched in an earlier upload (before that
      // player registered) may still have a stale pending entry; it's
      // resolved now, so clear it out.
      const stalePending = await prisma.pendingCardImage.findFirst({
        where: { name: entry.name },
      });
      if (stalePending) {
        await del(stalePending.filePath).catch(() => {});
        await prisma.pendingCardImage.delete({ where: { id: stalePending.id } });
      }
      matched++;
    } else {
      // Re-uploading an updated roster is the normal workflow (new
      // players added), so upsert by name instead of piling up
      // duplicate pending entries for the same unmatched player.
      const existing = await prisma.pendingCardImage.findFirst({
        where: { name: entry.name },
      });
      const pendingId = existing?.id ?? randomUUID();
      const blob = await put(`pending/${pendingId}.jpg`, entry.photo, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/jpeg",
      });
      await prisma.pendingCardImage.upsert({
        where: { id: pendingId },
        create: {
          id: pendingId,
          filePath: blob.url,
          name: entry.name,
          uniformNumber: entry.uniformNumber,
          registrationNumber: entry.registrationNumber,
          birthDate: entry.birthDate,
        },
        update: {
          filePath: blob.url,
          uniformNumber: entry.uniformNumber,
          registrationNumber: entry.registrationNumber,
          birthDate: entry.birthDate,
        },
      });
      pending++;
    }
  }

  for (const { url, name } of uploads) {
    let buffer: Buffer;
    try {
      const res = await fetch(url);
      buffer = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      console.error("Failed to fetch uploaded roster", name, e);
      failed++;
      continue;
    }

    let rosterEntries;
    try {
      rosterEntries = await parseRosterPdf(buffer);
    } catch (e) {
      console.error("PDF parse failed for", name, e);
      continue;
    } finally {
      await del(url).catch(() => {});
    }

    // Each entry needs a Blob upload plus DB writes; running them in
    // parallel (rather than one player at a time) keeps a large roster well
    // under the function's time limit. A failure on one player's Blob/DB
    // write no longer aborts the rest of the batch.
    const results = await Promise.allSettled(rosterEntries.map(processEntry));
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Roster entry failed for", name, result.reason);
        failed++;
      }
    }
  }

  revalidatePath("/admin/cards");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return {
    matched,
    pending,
    error: failed > 0 ? `${failed}件の選手の処理に失敗しました。もう一度アップロードしてみてください` : undefined,
  };
}

export async function assignPendingCardAction(pendingId: string, userId: string) {
  await requireAdmin();

  const pendingImage = await prisma.pendingCardImage.findUnique({
    where: { id: pendingId },
  });
  if (!pendingImage) throw new Error("対象の画像が見つかりません");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("対象のユーザーが見つかりません");

  const copied = await copy(pendingImage.filePath, `cards/${userId}.jpg`, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  await del(pendingImage.filePath).catch(() => {});

  await prisma.user.update({
    where: { id: userId },
    data: {
      cardImagePath: copied.url,
      uniformNumber: pendingImage.uniformNumber,
      registrationNumber: pendingImage.registrationNumber,
      birthDate: pendingImage.birthDate,
    },
  });
  await prisma.pendingCardImage.delete({ where: { id: pendingId } });

  revalidatePath("/admin/cards");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function discardPendingCardAction(pendingId: string) {
  await requireAdmin();

  const pendingImage = await prisma.pendingCardImage.findUnique({
    where: { id: pendingId },
  });
  if (!pendingImage) return;

  await del(pendingImage.filePath).catch(() => {});
  await prisma.pendingCardImage.delete({ where: { id: pendingId } });

  revalidatePath("/admin/cards");
}
