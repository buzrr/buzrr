-- Encrypted, trimmed clips of a question's sound (the windows that play while
-- the question is open and at the reveal) and their keys.
-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "audioClip" TEXT,
ADD COLUMN     "audioClipKey" TEXT,
ADD COLUMN     "audioRevealClip" TEXT,
ADD COLUMN     "audioRevealKey" TEXT;
