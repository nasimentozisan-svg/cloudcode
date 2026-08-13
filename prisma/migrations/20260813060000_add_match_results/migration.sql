-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "ourScore" INTEGER NOT NULL,
    "opponentScore" INTEGER NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchScorer" (
    "id" TEXT NOT NULL,
    "matchResultId" TEXT NOT NULL,
    "number" INTEGER,
    "name" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MatchScorer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_eventId_key" ON "MatchResult"("eventId");

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScorer" ADD CONSTRAINT "MatchScorer_matchResultId_fkey" FOREIGN KEY ("matchResultId") REFERENCES "MatchResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

