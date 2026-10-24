# Data architecture: Postgres + Redis

Two stores with a hard division of labor:

- **PostgreSQL (via Prisma)** — durable domain data: identities, quizzes,
  lobby records, immutable results, moderation state. All in the **`public`**
  schema.
- **Redis (ioredis)** — everything that changes during a live game, plus
  matchmaking queues, invites, locks, and Socket.IO adapter pub/sub.

A **third owner** shares both stores without overlapping either: `apps/ai` owns
the Postgres `ai` schema (Alembic-migrated, pgvector) and the `ai:*` Redis
prefix. See [ai.md](ai.md) and [ADR-009](../adr/009-buzrr-ai-rag-service.md).

**Rule: live phase state stays in Redis — no per-answer or mid-game writes to
Postgres.** The engine comment in `game-store.service.ts` states it: "All state
that changes during a running game lives here; Postgres only sees the lobby
record and (later) final results."

The one exemption is **`GameSession.isPlaying`**, flipped to `true` once in
`startGame`. It is a lobby flag, not play state: join checks and the
player-play context read it to tell a waiting room from one already in
progress. Phase, question index and scores never appear in Postgres.

## Prisma package (`packages/prisma`)

- Schema: `packages/prisma/schema.prisma`; client generated into
  `packages/prisma/generated/client` (gitignored, regenerated on postinstall).
- Exported via `src/index.ts`: `prisma` singleton (pg driver adapter
  `@prisma/adapter-pg`, global-cached in dev) + `connectDatabase()` (5 retries)
  - all generated types.
- Env loading (`src/loadEnv.ts`): cwd `.env` first, then monorepo root `.env`,
  system env always wins.
- Two Prisma configs exist — root `prisma.config.ts` (used by root scripts
  `yarn prisma:generate`, `yarn db:push`; requires `DIRECT_URL`) and
  `packages/prisma/prisma.config.ts` (used inside the package, e.g.
  `yarn workspace @buzrr/prisma migrate:deploy`; falls back
  `DIRECT_URL → DATABASE_URL`). Local dev uses `db push` (via `yarn setup`);
  production applies committed migrations with `migrate deploy`.
- **The migration history can't build an empty database.** It begins with
  `20260619000001`, which alters a `users` table no migration creates (the
  history was started against an existing database). Fresh installs
  therefore go through `yarn workspace @buzrr/prisma deploy`
  (`scripts/deploy.mjs`, what the self-host `migrate` container runs): with
  no `_prisma_migrations` table it creates the schema with `db push`, marks
  every committed migration applied (Prisma's "baselining"), then runs
  `migrate deploy`; with history it is just `migrate deploy`. The same path
  baselines a `db push`ed dev database.

## Changing the schema (the workflow this repo actually uses)

There is **no `migrate dev` script anywhere** — migrations are hand-authored:

1. Edit `packages/prisma/schema.prisma`.
2. Write the SQL yourself in a new
   `packages/prisma/migrations/YYYYMMDD00000N_snake_description/migration.sql`
   (dated prefix + per-day counter, not real timestamps — match the existing
   folders; include explanatory `--` comments like the existing ones do).
3. Locally: `yarn db:push` (syncs schema directly) + `yarn prisma:generate`.
   Your SQL file is _not_ executed locally — `db push` derives the same end
   state, so make sure they agree.
4. Production applies your SQL via
   `yarn workspace @buzrr/prisma migrate:deploy`; self-hosted installs via
   `yarn workspace @buzrr/prisma deploy` (same migrations, plus baselining
   for a fresh database).
5. New model/enum types reach client components **only** through the
   type-only re-export `apps/web/src/types/db.ts` — add them there, never
   import `@buzrr/prisma` values in `"use client"` files.
6. If the change touches duel-pool eligibility or seeded content, check
   `packages/prisma/scripts/seed-duel-starter.mjs` (needs the package built
   first: `yarn workspace @buzrr/prisma build`).

## The `ai` schema (owned by `apps/ai`, not Prisma)

`knowledge_spaces`, `documents`, `chunks` (with a `vector(768)` column and an
HNSW index), `generation_runs`, `generated_questions`, `question_citations`.
Migrated by **Alembic** from `apps/ai/alembic/`, never by Prisma.

**Alembic never touches `public`; Prisma never touches `ai`** (invariant #30).
`alembic/env.py` enforces its half with `include_object`, and Prisma reports
`schema "public"` on every `db push`/`migrate`. There are deliberately **no
foreign keys from `ai.*` into `public.users`** — `user_id` is a plain `text`
column holding the JWT `sub`, which is what lets the two tools stay independent.
The practical consequence: deleting a Buzrr user does **not** cascade into the
`ai` schema.

Local Postgres runs `pgvector/pgvector:pg16` (not `postgres:16-alpine`) so the
`vector` extension is available. Full detail: [ai.md](ai.md).

## Postgres models (semantics, not a schema dump)

Read `schema.prisma` for fields; what matters is the _meaning_:

| Model                                | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Notes agents get wrong                                                                                                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                               | Signed-in account (Google or local email + password via Better Auth). Carries `eloRating` (default 1200), `duelsPlayed`, `hostSizeLimit` (manual room-cap override, default 50 — effective cap is `max(plan cap, hostSizeLimit)`), `role` (`user\|admin\|superadmin`), `dodoCustomerId`, the AI token counters (`freeAiTokensUsed`, `proAiTokensUsed`, `proAiWindowStart`), and the daily duel streak (`timeZone`, `currentStreak`, `bestStreak`, `lastStreakDay`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Role and plan are read fresh from DB on every check — never cached in tokens. `eloRating` is the **Random** duel rating only; category duels rate in `UserCategoryRating`. `currentStreak` is stale once `lastStreakDay` is older than yesterday — read it through `effectiveStreak`. |
| `Account`, `Session`, `Verification` | Better Auth tables (`@@map`ped to `accounts`/`sessions`/`verification`). Written by the **web** app's Better Auth adapter; the server only _reads_ `Session` for socket cookie auth.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Don't hand-write these; Better Auth owns their shape.                                                                                                                                                                                                                                 |
| `Player`                             | **Ephemeral guest identity** for classic mode. Created anonymously (`POST /api/players`), joined to a room by setting `gameId`, detached (never deleted) when the game ends or they're kicked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Player rows accumulate forever by design (identity survives across rooms). A ban does _not_ live here — it's Redis, room-scoped.                                                                                                                                                      |
| `Quiz` / `Question` / `Option`       | Host-authored content. `Question.type` (string, default `multiple_choice`) picks the question-type handler and `Question.config` (JSON) holds its settings — both validated by that handler on every write ([ADR-011](../adr/011-pluggable-question-types.md)); `Option` rows are the generic options/answer key for the option-based types (true / false has none: its key is `config.answer`). Options are read in `createdAt` order, and every write stamps them one millisecond apart (`common/utils/option-order.ts`) so the authored order — the editor's drag/shuffle, the AI's shuffle — is the order players see. `Question.order` is a 1-based dense sequence maintained by reorder/delete transactions (`questions.service.ts`). `Quiz.isPublic` + `Question.moderationStatus` gate the duel pool. `Question.quizId` is **nullable**: standalone questions (no quiz, `POST /api/questions`) feed only the duel pool. `Question.createdById` is the author and the edit/delete ownership check (falls back to `quiz.userId` for rows without one). | Editing a question resets it to `pending` (if public) and wipes its reports — approval does not survive edits. `type` is deliberately not an enum: new types need no migration; unknown values are skipped at game start.                                                             |
| `Quiz.settings`                      | Per-quiz options (JSON, default `{}`), validated by contract `quizSettingsSchema` on `PATCH /quizzes/:id`: `sound` (skin, where sounds play, music), `moderation` (moderated mode), `reactions` (live reactions on/off, default on). A game may override them (`GameSession.settings`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Missing keys fall back to the defaults, so a new option needs no migration.                                                                                                                                                                                                           |
| `Question.disabled`                  | Owner switch: the question stays in the quiz and editor but games, question counts and scoring skip it (`PATCH /questions/:id/disabled`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Filter `disabled: false` wherever questions are counted or played.                                                                                                                                                                                                                    |
| `Category` / `QuestionCategory`      | Duel topics. A question has zero or more categories (explicit join table so the raw duel-pool SQL can join it). `Category.hue` is the swatch colour.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Players only see categories with ≥7 pool questions (`GET /api/duel/categories`). Admin retagging doesn't re-moderate.                                                                                                                                                                 |
| `UserCategoryRating`                 | Per-(user, category) duel rating + `duelsPlayed` (K-factor).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Created lazily on the first rated duel in that category; a missing row means 1200.                                                                                                                                                                                                    |
| `DuelDay`                            | One row per local calendar day on which a user finished a duel — the streak calendar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Written in the `persistResult` transaction; `@db.Date` in the user's time zone, not UTC.                                                                                                                                                                                              |
| `QuestionReport`                     | One row per distinct reporter (`@@unique([questionId, reporterUserId])`); >5 distinct reports auto-unapprove.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Reports are deleted on approve/unapprove/edit.                                                                                                                                                                                                                                        |
| `GameSession`                        | Classic **lobby record only**: `gameCode` (unique, 6-char), `quizId`, `creatorId`, `isPlaying`, `settings` (JSON, the game's own `quizSettingsSchema` from the "Host quiz" dialog; null = the quiz's — read via `roomSettings`). Deleted when the game ends.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `isPlaying` is the only gameplay flag here — phase and question index live in Redis. Duels have **no** GameSession.                                                                                                                                                                   |
| `GameResult` / `GameResultEntry`     | The only durable trace of a finished game (schema comment: "Immutable record of a finished game"). Entries snapshot `playerName`/`profilePic` because Player rows are ephemeral; `userId` set for signed-in participants; `eloBefore/After` for rated duels (category rating for category duels); `outcome` (win/loss/draw) for duels; `GameResult.categoryId` for category duels (null = Random). Nullable `quizId`/`hostId`/`categoryId` survive later deletion.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Never mutate results. The only deletion: a classic game's host or the quiz's owner removes runs (`DELETE /game-sessions/results/…`; entries cascade). Read paths: host history, duel history, profile stats.                                                                          |
| `Subscription`                       | Mirror of a Dodo subscription: status, period dates, `cancelAtPeriodEnd`, customer, product. Plans are derived from these rows on every check.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Written only by `SubscriptionSyncService` from Dodo-fetched state. `userId` is `SET NULL` on account deletion so billing history survives.                                                                                                                                            |
| `BillingEvent`                       | Webhook idempotency ledger keyed by Dodo's `webhook-id`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | The claim commits in the same transaction as the event's effects — never insert it on its own.                                                                                                                                                                                        |
| `Payment`                            | Audit trail of `payment.succeeded` / `payment.failed`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Informational only; access never depends on it.                                                                                                                                                                                                                                       |
| `AiTokenReservation`                 | One AI generation's token spend (`bucket` free/pro, `windowStart`), refundable once via a hashed release token.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | The counters live on `User`; this row only makes refunds exact and idempotent.                                                                                                                                                                                                        |

Migrations live in `packages/prisma/migrations/` and are the change history:
notable ones are `20260712000003_drop_unused_tables` (dropped `PlayerAnswer` +
`GameLeaderboard` when live state moved to Redis) and
`20260714000001_add_roles_and_question_moderation` (roles + moderation
backfill; also documents the seeded system user and initial superadmin).
`20260914000001_add_billing_and_entitlements` adds Buzrr Pro billing
([ADR-010](../adr/010-billing-and-entitlements.md)).
`20261006000001_add_question_type_and_config` adds `Question.type`/`config`.
`20261015000001_standalone_questions_categories_streaks` makes `quizId`
optional, adds `createdById`, categories, per-category ratings, duel
outcomes and the daily streak ([ADR-015](../adr/015-duel-categories-and-standalone-questions.md));
it backfills `createdById` from quizzes and historical duel outcomes by score.

## Billing data (Buzrr Pro)

- **A plan is never stored.** `EntitlementsService.resolvePlan` derives it on
  every check from `subscriptions`: Pro means `status = active` with the
  billing date at most 48h past, or a cancel-at-period-end `cancelled`
  subscription whose paid period hasn't ended.
  With `BILLING` off, everyone gets Pro limits.
- **Who writes `subscriptions`.** Only `SubscriptionSyncService.apply`, fed by
  verified webhooks, the success-page sync or the 12h reconcile job (which
  also stamps `last_synced_at` on rows it checked). It always writes the state
  fetched from Dodo, under a `pg_advisory_xact_lock` keyed on the Dodo
  subscription id.
- **`billing_events`** is the webhook idempotency ledger, keyed by the Dodo
  `webhook-id` header. Its claim commits in the same transaction as the event's
  effects.
- **AI tokens.** They live on `users`:
  - `free_ai_tokens_used` is lifetime (cap 3).
  - `pro_ai_tokens_used` plus `pro_ai_window_start` form a rolling 7-day
    window, reset lazily by the next reservation.
  - Spending is one conditional `UPDATE`. Each spend adds an
    `ai_token_reservations` row whose hashed release token allows exactly one
    refund, into the same window only.
- Billing's only Redis key is `billing:reconcile:lock`, which lets one
  instance run each 12h reconcile pass (see the keyspace map below).

## Redis keyspace (complete map)

All game access goes through `GameStoreService` — **do not** issue raw game
keys elsewhere. TTL for `game:*` is 6h, renewed on every write.

| Key                                                | Type                 | Written by                                            | Purpose                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------- | -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game:{code}:meta`                                 | hash                 | store (`initMeta` HSETNX-guarded, `patchMeta`)        | `GameMeta`: phase, mode, `pacing` (`host`\|`auto`), qIndex/qId/deadlines, hostConnected, `rated`, bot fields (`botId/tier/elo`, `botAnswer` JSON — legacy `botOptionId` — and `botAnswerAt`). Strings on the wire — numeric/boolean fields must be listed in `NUMERIC_META`/`BOOLEAN_META`. |
| `game:{code}:questions`                            | string (JSON)        | store                                                 | Full question snapshot (`LiveQuestion`: `type`, `config`, options **including `isCorrect`**) — server-only; emit only through the type's `toPublic`. Snapshots from before `type` existed are read as multiple choice.                                                                      |
| `game:{code}:answers:{qIndex}`                     | hash                 | store (`recordAnswer` Lua: `HSETNX` first-write-wins) | playerId → `StoredAnswer` JSON (`answer` in the question type's shape, timing, verdict, score; legacy `{optionId}` rows are normalised on read).                                                                                                                                            |
| `game:{code}:lb`                                   | zset                 | store (`ZINCRBY`)                                     | Live leaderboard, score-descending.                                                                                                                                                                                                                                                         |
| `game:{code}:players`                              | hash                 | store                                                 | Roster: playerId → `RosterEntry` JSON (`connected`, `lastSeenAt`, optional `userId` for duels).                                                                                                                                                                                             |
| `game:{code}:banned`                               | set                  | store                                                 | Room-scoped ban list; checked atomically with roster writes (`REGISTER_PLAYER_SCRIPT`). Dies with the room.                                                                                                                                                                                 |
| `game:{code}:departed`                             | hash                 | store (`REMOVE_PLAYER_SCRIPT` Lua)                    | playerId → score of a player who left or was removed; restored to `lb` when they rejoin (`REGISTER_PLAYER_SCRIPT`). Dies with the room.                                                                                                                                                     |
| `game:{code}:owner`                                | string               | store (`SET NX PX 20000` + renew Lua)                 | Timer-ownership lock: one instance drives a game's transitions.                                                                                                                                                                                                                             |
| `games:deadlines`                                  | zset                 | store                                                 | Global schedule: code → next transition ms (or far-future "parked" entries so host-paced games stay visible to the sweeper). Drives timer recovery + sweeper.                                                                                                                               |
| `mm:duel:queue` / `mm:duel:meta` / `mm:duel:lock`  | zset / hash / string | `matchmaking.service.ts`                              | Queue scored by the rating for the searched category, member metadata (incl. `category`; only equal categories pair), pairing lock.                                                                                                                                                         |
| `billing:reconcile:lock`                           | string               | `billing-reconcile.service.ts` (`SET NX PX 11h`)      | One reconcile pass per 12h across instances (only when `BILLING=ON`).                                                                                                                                                                                                                       |
| `duel:invite:{code}` / `duel:invite:host:{userId}` | hash / string        | `duel-invite.service.ts` (Lua scripts)                | Friend-challenge reservation incl. `categoryId`/`categoryName` (15min TTL; claimed lingers 60s) + one-pending-invite-per-host index.                                                                                                                                                        |
| `ai:arq:queue*`                                    | arq internals        | Buzrr-AI ingestion job queue (`apps/ai`)              |
| `ai:rl:{action}:{userId}`                          | zset                 | Buzrr-AI per-user rate limits (uploads, generations)  |
| socket.io adapter channels                         | pub/sub              | `@socket.io/redis-adapter`                            | Cross-instance room broadcasts.                                                                                                                                                                                                                                                             |

Three ioredis clients exist (`apps/server/src/redis/redis.module.ts`):
`REDIS` (commands), `REDIS_PUB`/`REDIS_SUB` (adapter). All from `REDIS_URL`;
the server **refuses to boot without it**.

## Lifecycle walkthroughs

**Classic game**

1. Host: `POST /api/game-sessions` → `GameSession` row + unique code (+ the
   game's settings, if changed in the "Host quiz" dialog).
2. Guest: `POST /api/players` (Player row + player JWT) → `POST
/api/game-sessions/join` — serializable transaction enforces the host's
   plan room cap (`EntitlementsService.maxPlayersFor`) without double-join
   overshoot; rejects banned players.
3. Sockets connect → `engine.ensureLiveSession` seeds `game:{code}:meta`
   (idempotent).
4. `start-game` → engine snapshots quiz questions from Postgres into Redis
   (each row through its type's handler; unplayable rows are skipped),
   sets `isPlaying: true` (the one gameplay flag Postgres carries, read by
   join checks), runs the phase machine entirely in Redis.
5. `endGame` → `GameResult(+entries)` insert; delete `GameSession`, detach
   `Player.gameId`; delete all `game:{code}:*`.

**Duel** — no Postgres until the end: queue/invite (Redis) → `startDuel` seeds
Redis → play → `persistResult` writes `GameResult` + ELO updates in one
transaction → Redis wiped.

## Consistency notes (read before "optimizing")

- Cross-store consistency is **best-effort by ordering**, not transactional:
  the code sequences writes so failures are safe (ban before detach in
  `banPlayerFromRoom`; claim-ended before persist; broadcast before
  disconnect on kick). Preserve the stated orderings — comments at each site
  explain the race being closed.
- Idempotency patterns everywhere: HSETNX meta init, first-answer-wins,
  `claimEnded`, `deleteMany` cleanups, report unique-constraint no-op. New
  code paths should follow suit — assume any handler can run twice or on two
  instances at once.
- The 6h TTL is the hard ceiling on game length and also the garbage
  collector for abandoned rooms — don't remove TTL renewals from store
  methods.
