-- AlterTable
ALTER TABLE "User" DROP COLUMN "lastScheduleVisitAt";

-- CreateTable
CREATE TABLE "EventRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventRead_userId_eventId_key" ON "EventRead"("userId", "eventId");

-- AddForeignKey
ALTER TABLE "EventRead" ADD CONSTRAINT "EventRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRead" ADD CONSTRAINT "EventRead_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: mark every existing event as already-read for every existing
-- user, so events created before this feature shipped don't all suddenly
-- show up as "NEW" for everyone.
INSERT INTO "EventRead" ("id", "userId", "eventId", "readAt")
SELECT md5(random()::text || clock_timestamp()::text || u."id" || e."id"), u."id", e."id", CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN "Event" e
ON CONFLICT ("userId", "eventId") DO NOTHING;
