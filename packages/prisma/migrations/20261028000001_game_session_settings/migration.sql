-- Per-session host settings: question-first reading time and player reactions.
ALTER TABLE "GameSession" ADD COLUMN "readTimeSec" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GameSession" ADD COLUMN "reactionsEnabled" BOOLEAN NOT NULL DEFAULT false;
