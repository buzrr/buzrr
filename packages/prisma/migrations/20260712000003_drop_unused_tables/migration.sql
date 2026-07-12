-- PlayerAnswer and GameLeaderboard tables are no longer used by the engine.
-- Live state lives in Redis; final state is persisted as GameResult + entries.

-- Drop foreign key constraint if it exists (varies by DB schema history)
ALTER TABLE IF EXISTS "PlayerAnswer" DROP CONSTRAINT IF EXISTS "PlayerAnswer_gameSessionId_fkey";
ALTER TABLE IF EXISTS "GameLeaderboard" DROP CONSTRAINT IF EXISTS "GameLeaderboard_gameSessionId_fkey";

-- Drop the unused tables
DROP TABLE IF EXISTS "PlayerAnswer";
DROP TABLE IF EXISTS "GameLeaderboard";
