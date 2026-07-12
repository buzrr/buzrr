-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('classic', 'duel');

-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "gameCode" TEXT NOT NULL,
    "mode" "GameMode" NOT NULL DEFAULT 'classic',
    "quizId" TEXT,
    "quizTitle" TEXT NOT NULL,
    "hostId" TEXT,
    "playerCount" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResultEntry" (
    "id" TEXT NOT NULL,
    "gameResultId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "profilePic" TEXT,
    "userId" TEXT,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "eloBefore" INTEGER,
    "eloAfter" INTEGER,

    CONSTRAINT "GameResultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameResult_hostId_idx" ON "GameResult"("hostId");

-- CreateIndex
CREATE INDEX "GameResult_quizId_idx" ON "GameResult"("quizId");

-- CreateIndex
CREATE INDEX "GameResultEntry_userId_idx" ON "GameResultEntry"("userId");

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResultEntry" ADD CONSTRAINT "GameResultEntry_gameResultId_fkey" FOREIGN KEY ("gameResultId") REFERENCES "GameResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
