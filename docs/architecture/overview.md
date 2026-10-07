# System overview

> Verified against the code on 2026-08-14. If this drifts from the code, the
> code wins — fix this file.

## Topology

```mermaid
flowchart LR
    B([Browser])
    B -- "SSR / Better Auth cookies" --> W["apps/web — Next.js 15<br/>hosts /api/auth/* + /api/webhooks/dodo"]
    B -- "REST /api/* (JWT bearer)" --> S["apps/server — NestJS 11"]
    B -- "Socket.IO (JWT or cookie)" --> S
    W -- "Prisma (auth tables, role reads)" --> PG[(PostgreSQL)]
    S -- "Prisma (domain tables)" --> PG
    S -- "live game state + locks + adapter pub/sub" --> R[(Redis)]
    S -. "optional: Gemini or any OpenAI-compatible server" .-> GEM["Model API"]
    S -. "Cloudinary / S3-compatible / local disk" .-> CLD["Media storage"]
    S -. "optional (rate limit, REST)" .-> UP["Upstash Redis REST"]
```

Two deployable apps, one shared DB package:

- **`apps/web`** — Next.js App Router frontend. Its only API routes are Better
  Auth (`src/app/api/auth/[...all]/route.ts`) and a JWT minting endpoint
  (`src/app/api/auth/access-token/route.ts`). All domain data flows through the
  Nest server; the web app touches Postgres directly only for auth/session and
  role lookups (`src/lib/auth.ts`, `src/lib/get-current-role.ts`, both
  `server-only`).
- **`apps/server`** — single NestJS process serving REST under the global
  prefix `/api` (health check exempt at `/health`) **and** the Socket.IO
  gateway on the same port (`src/main.ts`). Owns every game rule.
- **`packages/prisma`** — `@buzrr/prisma`. One schema, one generated client
  (into `generated/client`, exported via `src/index.ts` with a global-singleton
  `prisma` and `connectDatabase()` retry helper).
- **`packages/contract`** — `@buzrr/contract`. Zod schemas for the socket
  contract, the per-question-type shapes and question-carrying REST bodies;
  both apps compile against it ([ADR-013](../adr/013-shared-contract-package.md)).

## The two game modes share one engine

Both classic rooms and 1v1 duels run on the same phase machine — a pure
function in `apps/server/src/modules/game-engine/core/machine.ts`, driven by
the `GameEngineService` shell ([ADR-012](../adr/012-pure-engine-core-and-pacing.md)):

```text
lobby → starting → question ⇄ reveal → final → ended
```

- **Classic**: host-paced (the `hostPaced` pacing strategy). A `GameSession`
  row in Postgres backs the lobby (join checks, room codes); `host-next`
  drives phase advances; reveal/final wait for the host.
- **Duel**: hostless and Redis-only — **no `GameSession` row exists**. The
  `autoAdvance` strategy moves on by itself (reveal lasts 4s) and the engine
  applies ELO at the end.

What a question _is_ — how it's answered, scored, hidden and revealed — is
the question type's business, not the engine's: one handler per type on the
server, one renderer per type on the web
([ADR-011](../adr/011-pluggable-question-types.md)).

During play, all mutable state (meta, question snapshot, answers, leaderboard,
roster, bans) lives in Redis under `game:{code}:*` with a 6h TTL
(`game-store.service.ts`). When a game ends, the only durable artifact is an
immutable `GameResult` + `GameResultEntry` rows in Postgres; the `GameSession`
row and all Redis keys are deleted.

## Request/data paths at a glance

| Interaction                         | Path                                                                                                                                                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in                             | Browser → web `/api/auth/*` (Better Auth: Google OAuth and/or local email + password) → Postgres session                                                                                                                                                                                       |
| Upgrade to Pro                      | Browser → Nest `POST /api/billing/checkout` → Dodo hosted checkout → Dodo webhook → web `/api/webhooks/dodo` (verify) → Nest `POST /api/billing/webhooks/dodo` (re-verify, fetch subscription from Dodo, apply) → Postgres `subscriptions` ([ADR-010](../adr/010-billing-and-entitlements.md)) |
| Web → API auth                      | Browser fetches `/api/auth/access-token` (web signs HS256 JWT with `BETTER_AUTH_SECRET`) → sends `Authorization: Bearer` to Nest                                                                                                                                                               |
| CRUD (quizzes, questions, history…) | React Query hooks (`apps/web/src/lib/modules/*`) → axios → Nest controllers → services → Prisma                                                                                                                                                                                                |
| Live gameplay                       | Socket.IO client hooks (`apps/web/src/hooks/use*Socket*.ts`) → `RealtimeGateway` → `GameEngineService` → Redis; engine broadcasts to rooms via the Redis adapter                                                                                                                               |
| Matchmaking                         | Socket `userType=duel` → `MatchmakingService` (Redis zset queue, 2s worker) → `engine.startDuel`                                                                                                                                                                                               |
| AI quiz generation                  | Nest `POST /api/quizzes/ai` → `TextGenerator` (Gemini or an OpenAI-compatible server; `common/llm/`) — server-side only                                                                                                                                                                        |
| Image upload                        | Multipart `POST /api/quizzes/:quizId/questions` → `MediaStorage` (Cloudinary, S3-compatible or local disk; `common/storage/`)                                                                                                                                                                  |

## Key directories

```text
apps/server/src/
  main.ts                 # bootstrap: /api prefix, CORS, RedisIoAdapter, filters
  app.module.ts           # module wiring + global JwtAuthGuard
  redis/                  # 3 ioredis clients (commands/pub/sub) + socket.io adapter
  prisma/                 # PrismaService (thin wrapper over @buzrr/prisma singleton)
  common/                 # guards, decorators, filters, pipes, storage/ (media), llm/ (models), rate limit, elo/score/bot utils
  modules/
    game-engine/          # ★ core/ (pure phase machine, judging, views, pacing) + shell service + Redis store + bot driver
    question-types/       # ★ one pure handler per question type + registry
    realtime/             # ★ Socket.IO gateway, connection validation (contract types re-exported)
    duel/                 # matchmaking, friend invites, duel question pool, ELO endpoints
    game-sessions/        # classic rooms: create/join/kick/ban/end + history/results
    quizzes/ questions/   # quiz + question CRUD (incl. AI generation, import)
    moderation/           # public-question approve/report queue
    players/              # ephemeral guest identities + player JWTs
    admin-users/ users/   # superadmin role management; profile stats
    auth/ health/         # passport-jwt strategy; /health probe

apps/web/src/
  app/                    # App Router: admin/* (host), player/*+join/* (guest), duel/*, auth, landing
  hooks/                  # useGameSocket (core), useAdminSocket, usePlayerSocket, useDuelQueue, useDuelInvite, useServerCountdown
  state/                  # Redux Toolkit; game/gameSlice.ts mirrors server-pushed live state
  lib/api/                # axios clients + access-token cache
  lib/modules/<domain>/   # api.ts + hooks.ts (React Query) per backend domain
  types/socket.ts         # client-only socket types (payloads come from @buzrr/contract)
  components/             # Admin/, Player/, Duel/, Landing/, ui/, QuestionTypes/ (one renderer per type)

packages/contract/src/    # socket.ts, question-types.ts, rest.ts — the shared zod contract
```

## Buzrr-AI (`apps/ai`)

A third, **optional** deployable unit: Python 3.12 + FastAPI on :3002 plus an
arq worker. Users upload documents into a Knowledge Space; the service indexes
them (pgvector) and generates cited quiz questions from them. It shares Buzrr's
Postgres (its own `ai` schema), Redis (`ai:*` keys) and JWT secret, and writes
nothing to `public` — generated questions become a real quiz only through
`POST /api/quizzes/import` on the Nest server.

Unset `NEXT_PUBLIC_AI_API_URL` and it disappears from the UI entirely.
Detail: [ai.md](ai.md) · rationale: [ADR-009](../adr/009-buzrr-ai-rag-service.md).

## What is deliberately NOT here

- **No message queue / event bus** — cross-instance coordination is Redis
  (socket.io adapter pub/sub, locks, sorted-set deadlines), not a broker.
- **No end-to-end or web test suite** — `apps/server` has vitest specs
  (billing against Postgres; the pure engine core, question types, storage
  and LLM adapters without infrastructure) and `apps/ai` has pytest; the web
  app and the engine's I/O shell are covered only by lint/types/build
  (`.github/workflows/ci.yml`).
- **No web middleware auth** — route protection is per-layout/per-page server
  components (`apps/web/src/app/admin/layout.tsx`, `lib/duel-session.ts`).

## Related docs

- Realtime engine detail: [realtime.md](realtime.md)
- Duels: [duels.md](duels.md) · Data: [data.md](data.md) · Auth: [auth.md](auth.md)
- REST/backend: [backend.md](backend.md) · Frontend: [frontend.md](frontend.md)
- Deploy/env/CI: [infrastructure.md](infrastructure.md) · Rules: [invariants.md](invariants.md)
