-- Pro session report snapshot for classic games, written at game end.
ALTER TABLE "GameResult" ADD COLUMN "report" JSONB;
