# ADR-011: Pluggable question types

**Status:** Accepted

## Context

Every layer assumed one kind of question — four options, one correct. The
engine compared `optionId`s, the reveal payload was `counts` +
`correctOptionIds`, the socket answer was `{ optionId }`, bots picked option
ids, and four web screens drew option grids. The product roadmap (Phase 0 of
the 2026-10 plan) needs more types, and the project wants outside
contributors to be able to add one; with the old shape, each new type would
have been an edit to the engine, the contract and every game screen.

## Decision

1. **`Question.type` (string) + `Question.config` (JSON)** in Postgres.
   A string, not an enum: types are registered in code, so adding one needs
   no migration, and an unknown value is rejected by the registry rather
   than the database. Options stay in the `Option` table — they are shared,
   editable rows with ids that every option-based type can use.
2. **Wire shapes per type live in `@buzrr/contract`** (`question-types.ts`):
   `config`, `answer`, `publicQuestion`, `summary`, as zod schemas with a
   `type` discriminator on the public question and the reveal summary.
3. **One server handler per type** (`apps/server/src/modules/question-types/`)
   implementing `QuestionTypeHandler`: `validateDefinition` (check authored
   options + config), `checkAnswer`, `score`, `toPublic` (strip the answer
   key), `summarize` (the reveal), `sampleAnswer` (how bots play it).
   Handlers are pure. The engine, the editor/import endpoints and the duel
   pool call them only through `registry.ts`.
4. **One web renderer per type** (`apps/web/src/components/QuestionTypes/`):
   `AnswerInput`, `HostPrompt`, `RevealBreakdown`, `revealStats`,
   `describeAnswer`, `correctAnswers`. Game screens render questions only
   through these.
5. **Exhaustiveness is compiled in.** Both registries are mapped types over
   the contract's `QuestionType`, so a type added to the contract without a
   handler or a renderer fails `check-types`.
6. The socket contract became type-agnostic: `submit-answer` carries
   `{ qIndex, answer }`, `answer-result` carries `answer`, `question-end`
   carries `summary` (one contract version, both apps migrated together —
   ADR-002).

`multiple_choice` is the only type today; it is the old behaviour expressed
as a handler.

## Consequences

- A new type = contract block + handler + renderer + tests; no engine,
  gateway or screen edits (CONTRIBUTING.md § Adding a question type).
- Rows of a type the running build doesn't know, or that fail their type's
  checks, are skipped when a game loads (`toLiveQuestion` → null) instead of
  breaking the game.
- Live games that straddled the deploy keep working: Redis snapshots without
  `type`/`config`, answers stored as `{ optionId }` and bot plans stored as
  `botOptionId` are normalised on read.
- The question editor (`AddQuesForm`) still authors only four-option
  multiple choice; the API already accepts `type`, `config` and an `options`
  JSON array.

## Amendment (2026-10-14): six types, scoring and live results

- Types now: `multiple_choice` (4 options; single choice by default, or
  `config.multiSelect` — the editor's "Multiple correct answers" toggle —
  where players tick a set and only the exact set scores; unset on older
  rows means "multiple if more than one option is correct"), `true_false`,
  `poll` (optional multi-select), `word_cloud`, `rating` (1–5, 1–10 or stars)
  and `open_text`. The last four are **unscored**: `handler.scored = false`,
  answers are never correct and score 0.
- Handlers gained `scored` and `duelEligible(definition)`. Duels need one
  right answer for a head-to-head score, so only single-answer multiple
  choice (`multiSelect` off) and true / false are eligible; moderation and the duel pool use
  this (backend.md § Moderation).
- `summarize` now takes `{ answer, author }` entries, oldest first, so open
  text can name its authors (or not, when anonymous).
- New socket event `live-summary`, host room only, throttled to ~1/s in the
  engine shell, for unscored types (realtime.md § submit-answer step 7).
  Scored types still reveal only at question end. `HostPrompt` renderers get
  the `live` summary.
- Word cloud and open text can take **multiple submissions** (a per-question
  toggle): handlers gained optional `acceptsMoreAnswers` / `mergeAnswers`,
  further answers are merged into the stored one (no early close, server cap
  of 10 per player), and open text is stored as `{ entries }`. Their time
  slider runs 15–75s with a 45s default.
- Out of scope for now: "show results on players' screens", the word-cloud
  profanity filter and open-text host review.

## Evidence

`packages/contract/src/question-types.ts`,
`apps/server/src/modules/question-types/`,
`apps/web/src/components/QuestionTypes/`, migration
`20261006000001_add_question_type_and_config`.
