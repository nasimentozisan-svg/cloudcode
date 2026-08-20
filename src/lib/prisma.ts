import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// DATABASE_URL already points at Prisma Postgres's own pooled endpoint, so
// this pg.Pool only needs a small number of connections per function
// instance rather than node-postgres's default of 10 - a serverless
// function fanning out to 10 connections each, times many concurrent
// instances, is what exhausts the upstream pooler. attachDatabasePool keeps
// the function instance alive long enough for idle connections to be
// cleaned up properly instead of leaking when the instance freezes.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
attachDatabasePool(pool);
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
