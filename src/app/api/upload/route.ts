import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { requireAdmin } from "@/lib/require-admin";
import { isViewOnly } from "@/lib/categories";
import { MAX_ATTACHMENT_SIZE } from "@/lib/attachments";

// Client-side uploads: the browser PUTs the file straight to Blob storage
// using a short-lived token from here, instead of routing the file through
// a Next.js server action/route - Vercel's serverless functions hard-cap
// incoming request bodies at 4.5MB regardless of any app-level config, which
// silently broke both roster PDF and message attachment uploads above that
// size. clientPayload tells us which upload this is ("roster" vs
// "attachment") so we can apply the right auth check and size/type limits.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.PUBLICBLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (clientPayload === "roster") {
          await requireAdmin();
          return {
            allowedContentTypes: ["application/pdf"],
            maximumSizeInBytes: 50 * 1024 * 1024,
            addRandomSuffix: true,
          };
        }

        const user = await getCurrentUser();
        if (!user || isViewOnly(user.categories.map((c) => c.category))) {
          throw new Error("この種類のアカウントはメッセージ機能を利用できません");
        }
        return {
          maximumSizeInBytes: MAX_ATTACHMENT_SIZE,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "アップロードに失敗しました" },
      { status: 400 }
    );
  }
}
