-- Per-quiz settings (JSON, validated by quizSettingsSchema in @buzrr/contract).
-- First use: moderated mode (host-confirmed get-ready / answer / scores steps).
-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}';
