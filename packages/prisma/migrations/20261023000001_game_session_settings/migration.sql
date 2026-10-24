-- A game's own settings, chosen by the host when opening the room (the
-- "Host quiz" dialog); null = the quiz's.
-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "settings" JSONB;
