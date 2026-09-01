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
   `yarn workspace @buzrr/prisma migrate:deploy`.
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

| Model                                | Role                                                                                                                                                                                                                                                                                                                         | Notes agents get wrong                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `User`                               | Signed-in account (Google via Better Auth). Carries `eloRating` (default 1200), `duelsPlayed`, `hostSizeLimit` (room cap, default 50), `role` (`user\|admin\|superadmin`).                                                                                                                                                   | Role is read fresh from DB on every privileged check — never cached in tokens.                                                   |
| `Account`, `Session`, `Verification` | Better Auth tables (`@@map`ped to `accounts`/`sessions`/`verification`). Written by the **web** app's Better Auth adapter; the server only _reads_ `Session` for socket cookie auth.                                                                                                                                         | Don't hand-write these; Better Auth owns their shape.                                                                            |
| `Player`                             | **Ephemeral guest identity** for classic mode. Created anonymously (`POST /api/players`), joined to a room by setting `gameId`, detached (never deleted) when the game ends or they're kicked.                                                                                                                               | Player rows accumulate forever by design (identity survives across rooms). A ban does _not_ live here — it's Redis, room-scoped. |
| `Quiz` / `Question` / `Option`       | Host-authored content. `Question.order` is a 1-based dense sequence maintained by reorder/delete transactions (`questions.service.ts`). `Quiz.isPublic` + `Question.moderationStatus` gate the duel pool.                                                                                                                    | Editing a question resets it to `pending` (if public) and wipes its reports — approval does not survive edits.                   |
| `QuestionReport`                     | One row per distinct reporter (`@@unique([questionId, reporterUserId])`); >5 distinct reports auto-unapprove.                                                                                                                                                                                                                | Reports are deleted on approve/unapprove/edit.                                                                                   |
| `GameSession`                        | Classic **lobby record only**: `gameCode` (unique, 6-char), `quizId`, `creatorId`, `isPlaying`. Deleted when the game ends.                                                                                                                                                                                                  | `isPlaying` is the only gameplay flag here — phase and question index live in Redis. Duels have **no** GameSession.              |
| `GameResult` / `GameResultEntry`     | The only durable trace of a finished game (schema comment: "Immutable record of a finished game"). Entries snapshot `playerName`/`profilePic` because Player rows are ephemeral; `userId` set for signed-in participants; `eloBefore/After` for rated duels. Nullable `quizId`/`hostId` survive later deletion of quiz/host. | Never mutate results; append-only. Read paths: host history, duel history, profile stats.                                        |

Migrations live in `packages/prisma/migrations/` and are the change history:
notable ones are `20260712000003_drop_unused_tables` (dropped `PlayerAnswer` +
`GameLeaderboard` when live state moved to Redis) and
`20260714000001_add_roles_and_question_moderation` (roles + moderation
backfill; also documents the seeded system user and initial superadmin).

## Redis keyspace (complete map)

All game access goes through `GameStoreService` — **do not** issue raw game
keys elsewhere. TTL for `game:*` is 6h, renewed on every write.

| Key                                                | Type                 | Written by                                           | Purpose                                                                                                                                                                                                               |
| -------------------------------------------------- | -------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game:{code}:meta`                                 | hash                 | store (`initMeta` HSETNX-guarded, `patchMeta`)       | `GameMeta`: phase, mode, qIndex/qId/deadlines, hostConnected, `rated`, bot fields (`botId/tier/elo/optionId/answerAt`). Strings on the wire — numeric/boolean fields must be listed in `NUMERIC_META`/`BOOLEAN_META`. |
| `game:{code}:questions`                            | string (JSON)        | store                                                | Full question snapshot **including `isCorrect`** — server-only; strip via `toPublicQuestion` before emitting.                                                                                                         |
| `game:{code}:answers:{qIndex}`                     | hash                 | store (`HSETNX` first-write-wins)                    | playerId → `StoredAnswer` JSON.                                                                                                                                                                                       |
| `game:{code}:lb`                                   | zset                 | store (`ZINCRBY`)                                    | Live leaderboard, score-descending.                                                                                                                                                                                   |
| `game:{code}:players`                              | hash                 | store                                                | Roster: playerId → `RosterEntry` JSON (`connected`, `lastSeenAt`, optional `userId` for duels).                                                                                                                       |
| `game:{code}:banned`                               | set                  | store                                                | Room-scoped ban list; checked atomically with roster writes (`REGISTER_PLAYER_SCRIPT`). Dies with the room.                                                                                                           |
| `game:{code}:owner`                                | string               | store (`SET NX PX 20000` + renew Lua)                | Timer-ownership lock: one instance drives a game's transitions.                                                                                                                                                       |
| `games:deadlines`                                  | zset                 | store                                                | Global schedule: code → next transition ms (or far-future "parked" entries so host-paced games stay visible to the sweeper). Drives timer recovery + sweeper.                                                         |
| `mm:duel:queue` / `mm:duel:meta` / `mm:duel:lock`  | zset / hash / string | `matchmaking.service.ts`                             | ELO queue, member metadata, pairing lock.                                                                                                                                                                             |
| `duel:invite:{code}` / `duel:invite:host:{userId}` | hash / string        | `duel-invite.service.ts` (Lua scripts)               | Friend-challenge reservation (15min TTL; claimed lingers 60s) + one-pending-invite-per-host index.                                                                                                                    |
| `ai:arq:queue*`                                    | arq internals        | Buzrr-AI ingestion job queue (`apps/ai`)             |
| `ai:rl:{action}:{userId}`                          | zset                 | Buzrr-AI per-user rate limits (uploads, generations) |
| socket.io adapter channels                         | pub/sub              | `@socket.io/redis-adapter`                           | Cross-instance room broadcasts.                                                                                                                                                                                       |

Three ioredis clients exist (`apps/server/src/redis/redis.module.ts`):
`REDIS` (commands), `REDIS_PUB`/`REDIS_SUB` (adapter). All from `REDIS_URL`;
the server **refuses to boot without it**.

## Lifecycle walkthroughs

**Classic game**

1. Host: `POST /api/game-sessions` → `GameSession` row + unique code.
2. Guest: `POST /api/players` (Player row + player JWT) → `POST
/api/game-sessions/join` — serializable transaction enforces the host's
   `hostSizeLimit` cap without double-join overshoot; rejects banned players.
3. Sockets connect → `engine.ensureLiveSession` seeds `game:{code}:meta`
   (idempotent).
4. `start-game` → engine snapshots quiz questions from Postgres into Redis,
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
