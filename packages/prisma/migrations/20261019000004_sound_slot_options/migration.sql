-- Playback options per slot: user skins, and the built-in skins (superadmin).
-- AlterTable
ALTER TABLE "sound_skins" ADD COLUMN     "options" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "builtin_sound_options" (
    "skin_id" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builtin_sound_options_pkey" PRIMARY KEY ("skin_id")
);
