-- The final song of a sound skin, encrypted for preloading during the game.
-- AlterTable
ALTER TABLE "sound_skins" ADD COLUMN     "final_clip" JSONB;
