-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uniformNumber" INTEGER,
    "cardImagePath" TEXT,
    "shirtSize" TEXT,
    "pantsSize" TEXT,
    "jerseySize" TEXT,
    "receiveEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("cardImagePath", "createdAt", "email", "id", "isAdmin", "jerseySize", "name", "pantsSize", "passwordHash", "shirtSize", "uniformNumber", "updatedAt") SELECT "cardImagePath", "createdAt", "email", "id", "isAdmin", "jerseySize", "name", "pantsSize", "passwordHash", "shirtSize", "uniformNumber", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
