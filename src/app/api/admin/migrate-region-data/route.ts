import { NextRequest, NextResponse } from "next/server";
import pg from "pg";

// One-time tool for moving production data from the old (Tokyo) database to
// a new one in a region closer to Vercel's Function Region, to cut down
// cross-region query latency. Requires OLD_DATABASE_URL (the old DB) to be
// set alongside DATABASE_URL (the new DB, already migrated to the current
// schema by `prisma migrate deploy` during this same build). Safe to run
// more than once: every insert uses ON CONFLICT (id) DO NOTHING.
//
// Delete this route (and the OLD_DATABASE_URL / MIGRATION_SECRET env vars)
// once the migration has been confirmed successful.
export const dynamic = "force-dynamic";

const TABLES_IN_ORDER: { name: string; columns: string[] }[] = [
  {
    name: "User",
    columns: [
      "id",
      "email",
      "passwordHash",
      "name",
      "uniformNumber",
      "cardImagePath",
      "shirtSize",
      "pantsSize",
      "jerseySize",
      "receiveEmailNotifications",
      "calendarToken",
      "isAdmin",
      "createdAt",
      "updatedAt",
    ],
  },
  { name: "UserCategory", columns: ["id", "userId", "category"] },
  {
    name: "Channel",
    columns: ["id", "name", "description", "isDefault", "isGlobal", "createdById", "createdAt"],
  },
  { name: "ChannelCategory", columns: ["id", "channelId", "category"] },
  {
    name: "Event",
    columns: ["id", "title", "location", "notes", "startAt", "createdById", "createdAt", "updatedAt"],
  },
  { name: "EventCategory", columns: ["id", "eventId", "category"] },
  { name: "AttendanceResponse", columns: ["id", "eventId", "userId", "status", "respondedAt"] },
  { name: "Message", columns: ["id", "channelId", "authorId", "body", "createdAt"] },
  {
    name: "MatchResult",
    columns: [
      "id",
      "eventId",
      "opponent",
      "ourScore",
      "opponentScore",
      "recordedById",
      "createdAt",
      "updatedAt",
    ],
  },
  { name: "MatchScorer", columns: ["id", "matchResultId", "number", "name", "goals", "order"] },
  { name: "PendingCardImage", columns: ["id", "filePath", "name", "uniformNumber", "createdAt", "updatedAt"] },
];

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.MIGRATION_SECRET || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const oldUrl = process.env.OLD_DATABASE_URL;
  if (!oldUrl) {
    return NextResponse.json({ error: "OLD_DATABASE_URL is not set" }, { status: 500 });
  }

  const source = new pg.Pool({ connectionString: oldUrl });
  const target = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  const results: Record<string, number> = {};
  try {
    for (const table of TABLES_IN_ORDER) {
      const cols = table.columns.map((c) => `"${c}"`).join(", ");
      const { rows } = await source.query(`SELECT ${cols} FROM "${table.name}"`);
      const placeholders = table.columns.map((_, i) => `$${i + 1}`).join(", ");
      for (const row of rows) {
        const values = table.columns.map((c) => row[c]);
        await target.query(
          `INSERT INTO "${table.name}" (${cols}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
          values
        );
      }
      results[table.name] = rows.length;
    }
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e), partial: results },
      { status: 500 }
    );
  } finally {
    await source.end();
    await target.end();
  }
}
