-- How each question of a finished game went (the host's report). IF NOT
-- EXISTS: a no-op after a `db push` of this schema.
CREATE TABLE IF NOT EXISTS "GameResultQuestion" (
    "id" TEXT NOT NULL,
    "gameResultId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "image" TEXT,
    "options" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "responses" INTEGER NOT NULL,
    "correct" INTEGER,
    "avgTimeMs" INTEGER,

    CONSTRAINT "GameResultQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GameResultQuestion_gameResultId_idx" ON "GameResultQuestion"("gameResultId");

DO $$ BEGIN
  ALTER TABLE "GameResultQuestion" ADD CONSTRAINT "GameResultQuestion_gameResultId_fkey" FOREIGN KEY ("gameResultId") REFERENCES "GameResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
