-- Built-in skins can have files (public `builtin-*` uploads) and default
-- options to reset to.
-- AlterTable
ALTER TABLE "builtin_sound_options" ADD COLUMN     "slots" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "defaults" JSONB NOT NULL DEFAULT '{}';
