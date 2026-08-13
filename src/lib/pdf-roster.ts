import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import sharp from "sharp";

export type RosterEntry = {
  name: string;
  uniformNumber: number | null;
  photo: Buffer;
};

// Furigana rows are pure katakana; kanji/hiragana names never are, which is
// what distinguishes a name row from the furigana row directly below it.
const KATAKANA_ONLY = /^[゠-ヿー\s]+$/;

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
      for (const rowItems of rows.values()) {
        const inNameBand = rowItems.filter((it) => it.transform[4] >= 100 && it.transform[4] <= 150);
        if (inNameBand.length !== 2) continue;
        const combined = inNameBand.map((it) => it.str).join("");
        if (KATAKANA_ONLY.test(combined) || /\d/.test(combined)) continue;
        name = inNameBand
          .sort((x1, x2) => x1.transform[4] - x2.transform[4])
          .map((it) => it.str)
          .join("");
        break;
      }
      if (!name) continue;

      const photoName = photoNames[a];
      if (!photoName) continue;

      const imgObj = await new Promise<{
        width: number;
        height: number;
        data: Uint8ClampedArray;
      } | null>((resolve) => page.objs.get(photoName, resolve));
      if (!imgObj?.data) continue;

      const channels = Math.round(imgObj.data.length / (imgObj.width * imgObj.height));
      const photo = await sharp(Buffer.from(imgObj.data), {
        raw: { width: imgObj.width, height: imgObj.height, channels: channels as 1 | 2 | 3 | 4 },
      })
        .resize(240, 300, { fit: "cover" })
        .jpeg({ quality: 88 })
        .toBuffer();

      entries.push({
        name,
        uniformNumber: Number.isFinite(jerseyNumber) ? jerseyNumber : null,
        photo,
      });
    }
  }

  return entries;
}
