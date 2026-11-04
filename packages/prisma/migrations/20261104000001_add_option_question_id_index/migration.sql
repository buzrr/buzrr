-- The duel pool's "exactly one correct option" check looks up options per
-- question; without this index each lookup scans the whole table.
CREATE INDEX "Option_questionId_idx" ON "Option"("questionId");
