-- "Play alone": tests, attempts and their answers (ADR-016). IF NOT EXISTS:
-- a no-op after a `db push` of this schema.
CREATE TABLE IF NOT EXISTS "SoloTest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "quizId" TEXT,
    "title" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "practice" BOOLEAN NOT NULL DEFAULT false,
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoloTest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SoloAttempt" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "profilePic" TEXT,
    "qIndex" INTEGER NOT NULL DEFAULT -1,
    "qStartAt" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SoloAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SoloAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "qIndex" INTEGER NOT NULL,
    "answer" JSONB,
    "timeTakenMs" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoloAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SoloTest_code_key" ON "SoloTest"("code");
CREATE INDEX IF NOT EXISTS "SoloTest_hostId_idx" ON "SoloTest"("hostId");
CREATE INDEX IF NOT EXISTS "SoloTest_quizId_idx" ON "SoloTest"("quizId");
CREATE UNIQUE INDEX IF NOT EXISTS "SoloAttempt_testId_playerId_key" ON "SoloAttempt"("testId", "playerId");
CREATE UNIQUE INDEX IF NOT EXISTS "SoloAnswer_attemptId_qIndex_key" ON "SoloAnswer"("attemptId", "qIndex");

DO $$ BEGIN
  ALTER TABLE "SoloTest" ADD CONSTRAINT "SoloTest_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "SoloTest" ADD CONSTRAINT "SoloTest_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "SoloAttempt" ADD CONSTRAINT "SoloAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "SoloTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "SoloAnswer" ADD CONSTRAINT "SoloAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SoloAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
