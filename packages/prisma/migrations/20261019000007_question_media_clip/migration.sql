-- A question's picture as devices load it ahead of time: encrypted, the key
-- only with question-start (like the sound clips).
-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "mediaClip" TEXT,
ADD COLUMN     "mediaKey" TEXT;
