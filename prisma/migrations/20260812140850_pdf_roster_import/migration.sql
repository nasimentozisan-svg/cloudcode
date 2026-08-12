/*
  Warnings:

  - You are about to drop the column `extractedText` on the `PendingCardImage` table. All the data in the column will be lost.
  - Added the required column `name` to the `PendingCardImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PendingCardImage` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingCardImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uniformNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PendingCardImage" ("createdAt", "filePath", "id") SELECT "createdAt", "filePath", "id" FROM "PendingCardImage";
DROP TABLE "PendingCardImage";
ALTER TABLE "new_PendingCardImage" RENAME TO "PendingCardImage";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
