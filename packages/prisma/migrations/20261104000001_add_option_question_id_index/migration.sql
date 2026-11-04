-- The duel pool's "exactly one correct option" check looks up options per
-- question; without this index each lookup scans the whole table.
-- IF NOT EXISTS: must be a no-op on a database `db push`ed from this schema.
CREATE INDEX IF NOT EXISTS "Option_questionId_idx" ON "Option"("questionId");
