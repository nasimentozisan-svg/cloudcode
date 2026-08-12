import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

// Served dynamically (never statically cached) so newly-uploaded card
// images are visible immediately, rather than through Next's static file
// handling for `public/`, which can cache a 404 for a path that didn't
// exist yet and keep serving it after the file is written.
export const dynamic = "force-dynamic";

const CARDS_DIR = path.join(process.cwd(), "uploads", "cards");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const filePath = path.join(CARDS_DIR, ...segments);

  if (!filePath.startsWith(CARDS_DIR)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
