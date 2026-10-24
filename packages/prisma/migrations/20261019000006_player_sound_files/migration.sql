-- Small copies of every skin file for players' devices (mono, 64 kbit/s);
-- the host keeps the full-quality files.
-- AlterTable
ALTER TABLE "sound_skins" ADD COLUMN     "player_slots" JSONB NOT NULL DEFAULT '{}';
-- AlterTable
ALTER TABLE "builtin_sound_options" ADD COLUMN     "player_slots" JSONB NOT NULL DEFAULT '{}';
