# Contributing to Buzrr

Thanks for taking the time to contribute! 🎉 This guide covers everything you
need to get productive.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By
participating, you agree to uphold it. Please report unacceptable behavior to
the maintainers.

## Getting started

You'll need **Node ≥ 18** (20 LTS recommended) and **Docker**.

All changes come in as pull requests from forks — direct pushes to this
repository are not accepted. Start by **forking the repo** on GitHub, then
clone **your fork**:

```sh
git clone https://github.com/<your-username>/buzrr.git
cd buzrr
corepack enable          # enable the pinned Yarn 4
yarn install
yarn setup               # Postgres + Redis in Docker, .env files, schema
```

Then:

```sh
yarn dev                 # web :3000, api :3001
```

and create a local account at http://localhost:3000 (Google sign-in is
optional — see the [README](README.md#-develop-locally)).

## Development workflow

1. In your fork's clone, create a branch from `main`:
   `git checkout -b feat/short-description`.
2. Make your change. Keep it focused — one logical change per PR.
3. Run the checks locally (a `pre-commit` hook runs `yarn lint` + `yarn check-types`
   automatically):

   ```sh
   yarn lint
   yarn check-types
   yarn workspace server test   # engine core, question types, adapters (+ billing, needs Postgres)
   yarn workspace web test      # live-game slice
   yarn build          # optional but recommended — this is what CI runs
   yarn format         # apply Prettier
   ```

4. Commit, **push the branch to your fork**, and open a Pull Request from it
   against this repository's `main`.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org):

```text
feat: add ranked duel matchmaking
fix: prevent double-join on reconnect
refactor: server owns the game loop
docs: document local Docker setup
chore: bump prisma to 7.4
```

Common types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `ci`.

## Coding standards

- **TypeScript everywhere.** No new `any` unless truly unavoidable.
- **ESLint + Prettier** are the source of truth — run `yarn format` before pushing.
- **Match the surrounding code** — naming, structure, and comment density.
- **Database changes** go through Prisma. Edit
  [`packages/prisma/schema.prisma`](packages/prisma/schema.prisma); for local dev
  use `yarn db:push`, and add a migration under
  `packages/prisma/migrations` for anything headed to production.
- **Secrets never get committed.** `.env*` files are gitignored — only update the
  `.env.example` templates.

## Adding a question type

Question types are plugins: the game engine never needs to change
([ADR-011](docs/adr/011-pluggable-question-types.md)). Six ship today
(multiple choice, true / false, poll, word cloud, rating, open text). Using a
hypothetical `ordering` type as the example:

1. **Contract** — in
   [`packages/contract/src/question-types.ts`](packages/contract/src/question-types.ts),
   add a block like `multipleChoice` with four zod schemas: `config` (authored
   settings), `answer` (what a player sends), `publicQuestion` (what players
   see — never the answer key) and `summary` (what the reveal shows, with a
   `type` literal). Add it to `QUESTION_TYPES`, the three unions and
   `QuestionTypeMap` (and `SCORED_TYPES` if it awards points). Reuse an
   existing answer shape where one fits; a new one must be `.strict()` and
   not overlap the others in `questionAnswerSchema`.
2. **Server handler** — create
   `apps/server/src/modules/question-types/types/ordering.ts` implementing
   `QuestionTypeHandler<"ordering">` (`scored`, `validateDefinition`,
   `checkAnswer`, `score`, `toPublic`, `summarize`, `sampleAnswer` for duel
   bots, `duelEligible`) and register it in `registry.ts`. Unscored types
   automatically get live host results and stay out of moderation and duels. Handlers must be pure — no I/O, randomness
   only through the `random` argument.
3. **Web renderer** — create
   `apps/web/src/components/QuestionTypes/Ordering.tsx` implementing
   `QuestionRenderer<"ordering">` (`AnswerInput`, `HostPrompt` — which gets
   the `live` summary for unscored types —
   `RevealBreakdown`, `revealStats`, `describeAnswer`, `correctAnswers`) and
   register it in `index.tsx`, plus a `QUESTION_TYPE_META` entry and icon in
   `meta.tsx`.
4. **Tests** — a spec next to
   `apps/server/src/modules/question-types/__tests__/multiple-choice.spec.ts`
   covering validation, answer checking, scoring, `toPublic` (no answer
   key!) and the summary.

`yarn check-types` tells you when you've missed a step: both registries are
exhaustive over `QuestionType`, so a type without a handler or a renderer
doesn't compile. Authoring UI is separate — the question editor
(`AddQuesForm`) posts `type`, `config` and an `options` JSON array to
`POST /api/quizzes/:quizId/questions`; add the type's settings there.

## Pull request checklist

- [ ] `yarn lint`, `yarn check-types`, `yarn workspace server test`,
      `yarn workspace web test` and `yarn build` pass.
- [ ] The change is covered by the PR description (what & why).
- [ ] Docs/README updated if behavior or setup changed.
- [ ] No secrets, credentials, or personal data in the diff.

CI (lint, type-check, tests, build, and the `docker compose up` self-host
check) must be green before a PR can be merged. Thanks
again for contributing! 💛
