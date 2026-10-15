# ADR-015: Duel categories, standalone questions and the daily streak

**Status:** Accepted (migration
`20261015000001_standalone_questions_categories_streaks`)

## Context

The "Buzrr 1v1 Duel" design lets players pick a duel **category** (or
Random), shows a rating and record per category, and adds a **daily streak**
(one duel a day) with a calendar. Separately, the duel pool needs content
that isn't part of anyone's quiz, so it can be bulk-uploaded later. Until now
every question belonged to a quiz, ownership was derived only through
`Quiz.userId`, and pool eligibility came from `Quiz.isPublic`.

## Decision

1. **Standalone questions.** `Question.quizId` is nullable and
   `Question.createdById` holds ownership (backfilled from `Quiz.userId`;
   checks fall back to the quiz for rows without it). A standalone question
   skips `draft` and starts `pending`; once `approved` it is in the duel pool
   (pool = standalone **or** public-quiz questions, approved, duel-eligible).
   Creation is `POST /api/questions` (up to 500 per call), **admin-only**,
   because plan limits count quizzes, not questions.
2. **Categories are many-to-many** through an explicit `QuestionCategory`
   table (the raw pool SQL joins it). A question has zero or more (max 5).
   Admins retag from the moderation queue without re-moderation, since
   categories only choose which pool serves a question. _(2026-10-15:
   tagging became admin-only — the quiz editor and `POST /quizzes/import` no
   longer accept categories; admins tag from the Duel Portal.)_ Players see only
   categories with a full duel's worth (7) of pool questions.
3. **A rating per category.** `UserCategoryRating` (lazy, default 1200)
   holds a category's rating and its own provisional K-factor count; Random
   keeps `User.eloRating`, so existing ratings carry over unchanged. Matchmaking
   pairs only within the same category, keyed by that category's rating.
   Friend invites can carry a category and stay unrated.
4. **The daily streak counts any finished duel** (rated, unrated, bot), not
   forfeits, and a day is a calendar date in the user's stored IANA time zone
   (UTC if unknown). It is applied in the same `persistResult` transaction as
   the result, with one `DuelDay` row per day for the calendar. The stored
   count is decayed on read (`effectiveStreak`), never by a job.
5. `GameResultEntry.outcome` (win/loss/draw) is stored for duels so records
   per category are one grouped query; historical rows are backfilled by score.

The design's in-game "answer streak" points multiplier was **not** adopted:
scoring is unchanged.

## Consequences

- Rating history before this change is Random's; category ratings start
  fresh at 1200.
- Splitting the queue by category means thinner queues; the bot fallback and
  the web's "Switch to Random" after 10s keep waits short.
- Historical forfeits can't be reconstructed, so backfilled outcomes are
  score-based.
- A user can change their time zone, which could repeat or skip a day once;
  accepted for a streak with no rewards attached.
- There is no admin UI for creating categories yet — the seed script ships
  20 and the REST endpoints manage the rest.

## Evidence

`packages/prisma/schema.prisma`, the migration above,
`apps/server/src/modules/{categories,questions,duel}/`,
`apps/server/src/modules/game-engine/game-engine.service.ts`
(`persistResult`, `applyDuelRatings`, `applyDailyStreaks`),
`apps/server/src/common/utils/daily-streak.ts`,
`packages/prisma/scripts/seed-duel-starter.mjs`.
