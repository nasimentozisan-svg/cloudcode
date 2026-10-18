// Runs before `next build` (see package.json "build").
//
// A deploy must never change the production database by accident. Pending
// Prisma migrations are applied ONLY when the deploy was explicitly allowed
// to (RUN_DB_MIGRATIONS=1 set in the environment for that one deploy).
// Otherwise:
//   - no pending migrations  -> build continues (the normal case)
//   - pending migrations     -> build stops, so the deploy fails and the
//                               currently live version keeps running
//   - database unreachable   -> build stops (as it did before this script,
//                               when the build ran `prisma migrate deploy`)
import { spawnSync } from "node:child_process";

function prisma(args) {
  const r = spawnSync("npx", ["prisma", ...args], { encoding: "utf8" });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

if (process.env.RUN_DB_MIGRATIONS === "1") {
  console.log("[db-migrate-gate] RUN_DB_MIGRATIONS=1: applying pending migrations");
  const deploy = prisma(["migrate", "deploy"]);
  process.stdout.write(deploy.out);
  process.exit(deploy.code);
}

const status = prisma(["migrate", "status"]);
if (status.code === 0) {
  console.log("[db-migrate-gate] database schema is up to date");
  process.exit(0);
}
if (/not yet been applied/i.test(status.out)) {
  process.stdout.write(status.out);
  console.error(
    "[db-migrate-gate] Pending database migrations - NOT applying them automatically.\n" +
      "This deploy is stopped; the live version keeps running. To apply them, redeploy once\n" +
      "with RUN_DB_MIGRATIONS=1 (an approved database change), then remove that variable."
  );
  process.exit(1);
}
process.stdout.write(status.out);
console.error("[db-migrate-gate] Could not check the database migration status.");
process.exit(status.code || 1);
