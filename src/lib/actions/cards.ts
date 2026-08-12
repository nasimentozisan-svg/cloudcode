"use server";

import { randomUUID } from "node:crypto";
import { put, del, copy } from "@vercel/blob";
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

export async function uploadCardsAction(
  _prev: UploadCardsState,
  formData: FormData
): Promise<UploadCardsState> {
  await requireAdmin();

  const files = formData
    .getAll("rosters")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return { matched: 0, pending: 0, error: "PDFファイルを選択してください" };
  }

  const users = await prisma.user.findMany({ select: { id: true, name: true } });

  let matched = 0;
  let pending = 0;

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());

    let rosterEntries;
    try {
      rosterEntries = await parseRosterPdf(buffer);
    } catch (e) {
      console.error("PDF parse failed for", file.name, e);
      continue;
    }

    for (const entry of rosterEntries) {
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
          },
          update: {
            filePath: blob.url,
            uniformNumber: entry.uniformNumber,
          },
        });
        pending++;
      }
    }
  }

  revalidatePath("/admin/cards");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { matched, pending };
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
