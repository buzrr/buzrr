-- Pluggable question types (ADR-011). Existing rows are multiple choice, which
-- is exactly what the defaults say, so this is a metadata-only change.
ALTER TABLE "Question" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'multiple_choice';
ALTER TABLE "Question" ADD COLUMN "config" JSONB NOT NULL DEFAULT '{}';
