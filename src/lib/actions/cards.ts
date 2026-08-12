"use server";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { parseRosterPdf } from "@/lib/pdf-roster";
import { findNameMatches } from "@/lib/card-matching";

// Stored outside `public/` and served through /api/cards/[...path] instead
// of Next's static file handling, which can cache a 404 for a path that
// didn't exist yet at request time and keep serving that stale 404 even
// after the file is written (observed with `next start`).
const CARDS_DIR = path.join(process.cwd(), "uploads", "cards");
const PENDING_DIR = path.join(CARDS_DIR, "pending");

async function ensureDirs() {
  await fs.mkdir(CARDS_DIR, { recursive: true });
  await fs.mkdir(PENDING_DIR, { recursive: true });
}

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
  await ensureDirs();

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
        await fs.writeFile(path.join(CARDS_DIR, `${userId}.jpg`), entry.photo);
        await prisma.user.update({
          where: { id: userId },
          data: {
            cardImagePath: `/api/cards/${userId}.jpg`,
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
          await fs.unlink(path.join(CARDS_DIR, stalePending.filePath)).catch(() => {});
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
        await fs.writeFile(path.join(PENDING_DIR, `${pendingId}.jpg`), entry.photo);
        await prisma.pendingCardImage.upsert({
          where: { id: pendingId },
          create: {
            id: pendingId,
            filePath: `pending/${pendingId}.jpg`,
            name: entry.name,
            uniformNumber: entry.uniformNumber,
          },
          update: {
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

  const sourcePath = path.join(CARDS_DIR, pendingImage.filePath);
  const destPath = path.join(CARDS_DIR, `${userId}.jpg`);
  await fs.copyFile(sourcePath, destPath);
  await fs.unlink(sourcePath).catch(() => {});

  await prisma.user.update({
    where: { id: userId },
    data: {
      cardImagePath: `/api/cards/${userId}.jpg`,
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

  const sourcePath = path.join(CARDS_DIR, pendingImage.filePath);
  await fs.unlink(sourcePath).catch(() => {});
  await prisma.pendingCardImage.delete({ where: { id: pendingId } });

  revalidatePath("/admin/cards");
}
