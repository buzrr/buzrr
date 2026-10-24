-- Where a question's own sound plays (null = like the quiz).
-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "audioPlayOn" TEXT;
