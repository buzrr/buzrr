-- A user's defaults (logo, audio skin, avatar skin) and own avatar pictures.
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferences" JSONB NOT NULL DEFAULT '{}';
