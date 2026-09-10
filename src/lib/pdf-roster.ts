import { fileURLToPath } from "node:url";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import sharp from "sharp";

// On Vercel, pdfjs-dist's own pdf.worker.mjs (loaded via a runtime-computed
// path inside its own package folder) doesn't make it into the deployed
// function ("Cannot find module .../pdf.worker.mjs"), because the reference
// is dynamic and Vercel's build-time file tracer can't follow it. A local
// copy (src/lib/pdf-worker/pdf.worker.mjs, kept in outputFileTracingIncludes
// in next.config.ts) sidesteps that — pointed to here as raw workerSrc
// rather than statically imported, since importing it lets Turbopack try to
// bundle its internals and risks altering its runtime behavior.
//
// fileURLToPath() is given import.meta.url directly (a string) rather than
// a `new URL(...)` instance: constructing our own URL object here throws
// "must be of type string or an instance of URL. Received an instance of
// URL" under Turbopack, because the bundled `url` module's URL class isn't
// the same identity as the one instanceof-checked internally.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(currentDir, "pdf-worker", "pdf.worker.mjs");

export type RosterEntry = {
  name: string;
  uniformNumber: number | null;
  registrationNumber: string | null;
  birthDate: Date | null;
  photo: Buffer;
};

// Furigana rows are pure katakana; kanji/hiragana names never are, which is
// what distinguishes a name row from the furigana row directly below it.
const KATAKANA_ONLY = /^[゠-ヿー\s]+$/;

// 選手登録番号 (e.g. "F000112083") sits on the exact same row as the name,
// in the right-hand column - confirmed against a real JFA "登録選手一覧"
// export (both start with a single letter followed by digits).
const REGISTRATION_NUMBER_PATTERN = /^[A-Za-z]\d{4,}$/;
// 生年月日 sits two rows above the name row, same left column as the name's
// own surname/furigana. Anchored (no trailing text) so it doesn't match
// 有効期間 in the same column, which is formatted "2026/04/01～".
const BIRTH_DATE_PATTERN = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;

// JFA "登録選手一覧" roster PDFs render as a fixed table: a JFA logo once
// per page, then one row per player with 背番号 (jersey number) in a narrow
// left column, name in a two-part kanji cell, and an embedded photo. Field
// order is consistent, but optional fields (e.g. 特記事項) can be entirely
// absent, so rows are grouped by y-position rather than assumed to be a
// fixed item count.
export async function parseRosterPdf(buffer: Buffer): Promise<RosterEntry[]> {
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const entries: RosterEntry[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items.filter(
      (it): it is TextItem => "str" in it && it.str.trim() !== ""
    );

    // 背番号 anchors: narrow left column, integer-only text. Each one marks
    // the end of a player's block of text items.
    const anchorIndexes: number[] = [];
    items.forEach((it, idx) => {
      const x = it.transform[4];
      if (x >= 8 && x <= 22 && /^\d{1,3}$/.test(it.str.trim())) {
        anchorIndexes.push(idx);
      }
    });

    const opList = await page.getOperatorList();
    const imageNames: string[] = [];
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (opList.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
        imageNames.push(opList.argsArray[i][0] as string);
      }
    }
    // The first image painted on each page is the JFA logo; the rest are
    // player photos in the same top-to-bottom order as the jersey-number
    // anchors above.
    const photoNames = imageNames.slice(1);

    // First pass: cheap, synchronous-ish text grouping to work out each
    // player's name/jersey number/photo reference. Kept sequential since
    // it's fast and each iteration depends on the previous anchor's end
    // index.
    const playerMetas: {
      name: string;
      jerseyNumber: number;
      registrationNumber: string | null;
      birthDate: Date | null;
      photoName: string;
    }[] = [];
    let prevEnd = -1;
    for (let a = 0; a < anchorIndexes.length; a++) {
      const anchorIdx = anchorIndexes[a];
      const chunk = items.slice(prevEnd + 1, anchorIdx + 1);
      prevEnd = anchorIdx;

      const jerseyNumber = Number.parseInt(items[anchorIdx].str.trim(), 10);

      const rows = new Map<number, typeof chunk>();
      for (const it of chunk) {
        const y = Math.round(it.transform[5]);
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y)!.push(it);
      }

      let name = "";
      let registrationNumber: string | null = null;
      for (const rowItems of rows.values()) {
        const inNameBand = rowItems.filter((it) => it.transform[4] >= 100 && it.transform[4] <= 150);
        if (inNameBand.length !== 2) continue;
        const combined = inNameBand.map((it) => it.str).join("");
        if (KATAKANA_ONLY.test(combined) || /\d/.test(combined)) continue;
        name = inNameBand
          .sort((x1, x2) => x1.transform[4] - x2.transform[4])
          .map((it) => it.str)
          .join("");
        // 選手登録番号 is the same row as the name, in the right-hand column.
        const regItem = rowItems.find(
          (it) => it.transform[4] >= 450 && REGISTRATION_NUMBER_PATTERN.test(it.str.trim())
        );
        if (regItem) registrationNumber = regItem.str.trim();
        break;
      }
      if (!name) continue;

      let birthDate: Date | null = null;
      for (const rowItems of rows.values()) {
        const dateItem = rowItems.find((it) => {
          const x = it.transform[4];
          return x >= 95 && x <= 160 && BIRTH_DATE_PATTERN.test(it.str.trim());
        });
        if (!dateItem) continue;
        const match = dateItem.str.trim().match(BIRTH_DATE_PATTERN);
        if (!match) continue;
        const [, year, month, day] = match;
        birthDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
        break;
      }

      const photoName = photoNames[a];
      if (!photoName) continue;

      playerMetas.push({ name, jerseyNumber, registrationNumber, birthDate, photoName });
    }

    // Second pass: the actual slow work (pulling the raw embedded image out
    // of the PDF and re-encoding it with sharp). Independent per player, so
    // run them concurrently instead of one at a time - with a couple dozen
    // players this is the difference between single-digit seconds and
    // running into Vercel's function time limit.
    const pageEntries = await Promise.all(
      playerMetas.map(async (meta): Promise<RosterEntry | null> => {
        const imgObj = await new Promise<{
          width: number;
          height: number;
          data: Uint8ClampedArray;
        } | null>((resolve) => page.objs.get(meta.photoName, resolve));
        if (!imgObj?.data) return null;

        const channels = Math.round(imgObj.data.length / (imgObj.width * imgObj.height));
        const photo = await sharp(Buffer.from(imgObj.data), {
          raw: { width: imgObj.width, height: imgObj.height, channels: channels as 1 | 2 | 3 | 4 },
        })
          .resize(240, 300, { fit: "cover" })
          .jpeg({ quality: 88 })
          .toBuffer();

        return {
          name: meta.name,
          uniformNumber: Number.isFinite(meta.jerseyNumber) ? meta.jerseyNumber : null,
          registrationNumber: meta.registrationNumber,
          birthDate: meta.birthDate,
          photo,
        };
      })
    );
    entries.push(...pageEntries.filter((e): e is RosterEntry => e !== null));
  }

  return entries;
}
