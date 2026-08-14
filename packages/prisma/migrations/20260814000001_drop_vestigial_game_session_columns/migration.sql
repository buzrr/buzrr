-- GameSession.gameState and GameSession.currentQuestion are vestigial: since the
-- server-authoritative rewrite the engine never advances them (live phase and
-- question index live in Redis, final state in GameResult). Only `isPlaying` is
-- still written and read, so it stays.

-- Drop the columns
ALTER TABLE "GameSession" DROP COLUMN IF EXISTS "gameState";
ALTER TABLE "GameSession" DROP COLUMN IF EXISTS "currentQuestion";

-- The enum existed only for the dropped column
DROP TYPE IF EXISTS "GameStates";
