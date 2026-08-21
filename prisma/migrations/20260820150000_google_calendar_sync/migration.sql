-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "googleCalendarEventId" TEXT;

-- CreateTable
CREATE TABLE "PendingGoogleDeletion" (
    "id" TEXT NOT NULL,
    "googleCalendarEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingGoogleDeletion_pkey" PRIMARY KEY ("id")
);
