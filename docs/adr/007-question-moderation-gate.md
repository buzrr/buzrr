# ADR-007: Per-question moderation gate feeding the public duel pool

**Status:** Accepted (PR #18 `fa9bf29`; migration
`20260714000001_add_roles_and_question_moderation`)

## Context

Duel questions are drawn from community "public" quizzes. Before this,
`Quiz.isPublic` alone decided pool eligibility — meaning unreviewed
user-generated content could appear in ranked games. The migration states the
rationale outright: existing public questions "were never reviewed by a human
before this feature existed, so silently approving them would defeat the
point."

## Decision

- Per-question `moderationStatus`: `draft → pending → approved | unapproved`,
  plus `reportCount` and a `QuestionReport` table (one row per distinct
  reporter, DB-unique).
- Pool eligibility = `quiz.isPublic AND question.moderationStatus =
'approved'` (`duel-questions.service.ts`).
- Making a quiz public submits its `draft` questions as `pending`; **any
  edit** of a public question resets it to `pending` and wipes reports —
  approval doesn't survive content changes.
- In-game reporting: only `approved` questions; >5 distinct reporters
  auto-unapprove pending re-review.
- Reviewers: new `role` enum (`user/admin/superadmin`) with a
  superadmin-managed promote/demote flow; queue endpoints are role-guarded.
  The migration seeds the trusted "Duel Starter Pack" as pre-approved and
  bootstraps the first superadmin by email.

## Consequences

- The duel pool is human-curated; an empty pool is now possible if moderation
  lags (surfaced to users as "No duel questions are available"), mitigated by
  the seeded starter pack.
- Moderation state is coupled to the question write path — new question-edit
  surfaces must preserve the reset-to-pending behavior (invariant #20).

## Alternatives

Implicitly rejected: trusting `isPublic` alone (the prior state).

## Evidence

Migration `20260714000001` (comments); `moderation.service.ts`;
`questions.service.ts#upsertFromMultipart` comment; `quizzes.service.ts`
public-flip transaction; `duel-questions.service.ts`; schema comments on
`Question.moderationStatus` / `QuestionReport`.
