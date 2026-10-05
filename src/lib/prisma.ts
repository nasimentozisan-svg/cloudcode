import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { PrismaClient } from "@/generated/prisma/client";
import { FreshPool, POOL_OPTIONS, withRetry } from "@/lib/db-resilience";

function createPrisma() {
  // DATABASE_URL already points at Prisma Postgres's own pooled endpoint, so
  // this pool only needs a small number of connections per function
  // instance rather than node-postgres's default of 10 - a serverless
  // function fanning out to 10 connections each, times many concurrent
  // instances, is what exhausts the upstream pooler. attachDatabasePool keeps
  // the function instance alive long enough for idle connections to be
  // cleaned up properly instead of leaking when the instance freezes.
  // Timeouts, stale-connection discarding and read retries: see
  // src/lib/db-resilience.ts.
  const pool = new FreshPool({ ...POOL_OPTIONS, connectionString: process.env.DATABASE_URL });
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) }).$extends({
    query: {
      $allOperations: ({ operation, args, query }) => withRetry(operation, () => query(args)),
    },
  });
}

type AppPrismaClient = ReturnType<typeof createPrisma>;

const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
