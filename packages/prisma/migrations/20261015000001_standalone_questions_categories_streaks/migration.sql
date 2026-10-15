-- Standalone questions, duel categories, per-category ratings and the daily
-- duel streak (ADR-015).
--
-- * Question.quizId becomes nullable so questions can exist outside a quiz
--   (bulk-uploaded pool content); Question.createdById carries ownership that
--   used to be derived only through Quiz.userId.
-- * Category + QuestionCategory: a question belongs to zero or more
--   categories. UserCategoryRating holds a separate duel rating per category
--   ("Random" duels keep using users.elo_rating).
-- * GameResult.categoryId + GameResultEntry.outcome feed play counts and
--   per-category win/loss records.
-- * users.{time_zone,current_streak,best_streak,last_streak_day} + DuelDay
--   implement the daily duel streak and its calendar.
-- CreateEnum
CREATE TYPE "DuelOutcome" AS ENUM ('win', 'loss', 'draw');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "best_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "current_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_streak_day" DATE,
ADD COLUMN     "time_zone" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "createdById" TEXT,
ALTER COLUMN "quizId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "GameResult" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "GameResultEntry" ADD COLUMN     "outcome" "DuelOutcome";

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hue" INTEGER NOT NULL DEFAULT 270,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionCategory" (
    "questionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "QuestionCategory_pkey" PRIMARY KEY ("questionId","categoryId")
);

-- CreateTable
CREATE TABLE "UserCategoryRating" (
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "duelsPlayed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCategoryRating_pkey" PRIMARY KEY ("userId","categoryId")
);

-- CreateTable
CREATE TABLE "DuelDay" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "DuelDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "QuestionCategory_categoryId_idx" ON "QuestionCategory"("categoryId");

-- CreateIndex
CREATE INDEX "UserCategoryRating_categoryId_idx" ON "UserCategoryRating"("categoryId");

-- CreateIndex
CREATE INDEX "Question_createdById_idx" ON "Question"("createdById");

-- CreateIndex
CREATE INDEX "GameResult_categoryId_idx" ON "GameResult"("categoryId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionCategory" ADD CONSTRAINT "QuestionCategory_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionCategory" ADD CONSTRAINT "QuestionCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCategoryRating" ADD CONSTRAINT "UserCategoryRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCategoryRating" ADD CONSTRAINT "UserCategoryRating_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelDay" ADD CONSTRAINT "DuelDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: every existing question was authored by its quiz's owner.
UPDATE "Question" AS q
SET "createdById" = z."userId"
FROM "Quiz" AS z
WHERE z."id" = q."quizId" AND q."createdById" IS NULL;

-- Backfill: duel outcomes for finished duels, decided by score. Historical
-- forfeits aren't recorded anywhere, so a forfeiter who happened to lead on
-- score is counted as a win here -- an accepted approximation for old rows;
-- new results are written with the real outcome by persistResult.
UPDATE "GameResultEntry" AS e
SET "outcome" = CASE
    WHEN e."score" > o."score" THEN 'win'::"DuelOutcome"
    WHEN e."score" < o."score" THEN 'loss'::"DuelOutcome"
    ELSE 'draw'::"DuelOutcome"
  END
FROM "GameResultEntry" AS o, "GameResult" AS r
WHERE r."id" = e."gameResultId"
  AND o."gameResultId" = e."gameResultId"
  AND o."id" <> e."id"
  AND r."mode" = 'duel'
  AND r."playerCount" = 2
  AND e."outcome" IS NULL;
