-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin', 'superadmin');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('draft', 'pending', 'approved', 'unapproved');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'user';

-- AlterTable
ALTER TABLE "Question"
  ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'draft',
  ADD COLUMN "reportCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "QuestionReport" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionReport_questionId_reporterUserId_key" ON "QuestionReport"("questionId", "reporterUserId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "Question_moderationStatus_reportCount_idx" ON "Question"("moderationStatus", "reportCount");

-- AddForeignKey
ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing questions in currently-public quizzes re-enter the
-- moderation queue -- they were never reviewed by a human before this
-- feature existed, so silently approving them would defeat the point.
UPDATE "Question" AS q
SET "moderationStatus" = 'pending'
FROM "Quiz" AS z
WHERE z."id" = q."quizId" AND z."isPublic" = true;

-- Exception: the system-owned "Duel Starter Pack" (seeded by
-- packages/prisma/scripts/seed-duel-starter.mjs) is trusted, pre-vetted
-- content that keeps the duel pool non-empty immediately after this ships.
UPDATE "Question" AS q
SET "moderationStatus" = 'approved'
FROM "Quiz" AS z
JOIN "users" AS su ON su."id" = z."userId"
WHERE z."id" = q."quizId" AND z."isPublic" = true AND su."email" = 'system@buzrr.local';

-- Bootstrap the first superadmin so the promote/demote UI has an initial
-- operator (one-off; every user otherwise defaults to 'user').
UPDATE "users" SET "role" = 'superadmin' WHERE "email" = 'ansarialan31@gmail.com';
