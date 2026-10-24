-- Optional sound per question (an MP3 played on the host screen) and its two
-- cue points in milliseconds: where playback starts when the question opens
-- (it plays for the question's time) and where it starts at the reveal.
-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "audio" TEXT,
ADD COLUMN     "audioStartMs" INTEGER,
ADD COLUMN     "audioRevealMs" INTEGER;
