-- AlterTable
ALTER TABLE "User" ADD COLUMN "cardImagePath" TEXT;

-- CreateTable
CREATE TABLE "PendingCardImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
