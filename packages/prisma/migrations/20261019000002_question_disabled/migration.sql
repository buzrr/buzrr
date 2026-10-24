-- Disabled questions stay in the quiz but are skipped in games and counts.
-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false;
