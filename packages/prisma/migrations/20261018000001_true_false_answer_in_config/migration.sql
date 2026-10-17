-- True / false questions keep their answer key in Question.config
-- (`{ "answer": true | false }`) instead of a "True" and a "False" Option row
-- per question (ADR-011 amendment, 2026-10-18). Data only; no schema change.
--
-- Deploy the code first: it reads both shapes, so this can run any time after.
--
-- * Rows whose options are exactly a "True" and a "False", one of them
--   correct, get the key. Anything else is left as it was, options intact.
-- * Then the Option rows of every converted question are dropped.

UPDATE "Question" q
SET "config" = q."config" || jsonb_build_object('answer', c."isTrue")
FROM (
  SELECT o."questionId",
    bool_or(o."isCorrect" AND lower(trim(o."title")) = 'true') AS "isTrue"
  FROM "Option" o
  GROUP BY o."questionId"
  HAVING count(*) = 2
    AND count(*) FILTER (WHERE o."isCorrect") = 1
    AND bool_and(lower(trim(o."title")) IN ('true', 'false'))
    AND count(DISTINCT lower(trim(o."title"))) = 2
) c
WHERE q."id" = c."questionId"
  AND q."type" = 'true_false'
  AND NOT (q."config" ? 'answer');

DELETE FROM "Option" o
USING "Question" q
WHERE o."questionId" = q."id"
  AND q."type" = 'true_false'
  AND q."config" ? 'answer';
