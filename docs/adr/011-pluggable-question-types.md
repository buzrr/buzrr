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

## Evidence

`packages/contract/src/question-types.ts`,
`apps/server/src/modules/question-types/`,
`apps/web/src/components/QuestionTypes/`, migration
`20261006000001_add_question_type_and_config`.
