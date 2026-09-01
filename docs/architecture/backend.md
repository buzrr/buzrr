# Backend (NestJS) — modules, REST surface, conventions

`apps/server` is one NestJS 11 process: Express HTTP under global prefix
`/api` + Socket.IO on the same port. Realtime specifics live in
[realtime.md](realtime.md); auth/guards in [auth.md](auth.md). This file
covers everything else.

## Bootstrap (`src/main.ts`)

Order matters: shutdown hooks → `TRUST_PROXY` handling → `RedisIoAdapter` →
CORS (`WEB_ORIGIN` via `parseCorsOrigin`, credentials on) → global prefix
`api` (excluding `health`) → global `ValidationPipe({ transform: true,
whitelist: true, forbidNonWhitelisted: false })` → global
`AllExceptionsFilter` (HttpExceptions pass through with status; everything
else becomes a logged 500). Port: `API_PORT` ?? `PORT` ?? 3001.

## Module map (`src/app.module.ts`)

Global modules: `ConfigModule`, `RedisModule` (3 ioredis clients),
`CommonModule` (guards/services), `PrismaModule`. Feature modules:

| Module          | Controller routes (all under `/api`)                                                                                                                                                                                                                             | Depends on               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `health`        | `GET /health` (no prefix) — pings Postgres + Redis with 2s timeouts; 503 if either is down                                                                                                                                                                       | Prisma, REDIS            |
| `players`       | `POST /players` (mint guest + player JWT), `PATCH /players/name`, `GET /players/:id`, `PATCH /players/:id/clear-game` — all `@Public()` + rate-limited                                                                                                           | own JwtModule            |
| `game-sessions` | `POST /game-sessions` (create room), `POST /join`, `GET /player-play/:playerId` (public), `GET /history`, `GET /results/:resultId`, `GET /:roomId/lobby`, `POST /:roomId/end`, `DELETE /:roomId/players/:playerId` (kick), `POST /:roomId/players/:playerId/ban` | GameEngine               |
| `quizzes`       | CRUD `/quizzes`, `POST /quizzes/ai` (Gemini; `ai` rate profile), `POST /quizzes/import` (batch import from Buzrr-AI)                                                                                                                                             | Gemini via ConfigService |
| `questions`     | `PATCH /questions/reorder`, `DELETE /questions/:id`, `POST /questions/:id/report`; plus `QuizQuestionsController`: `GET/POST /quizzes/:quizId/questions` (multipart upsert w/ Cloudinary)                                                                        | Cloudinary, Moderation   |
| `moderation`    | `GET /moderation/questions`, `PATCH .../:id/approve`, `PATCH .../:id/unapprove` — `@Roles("admin","superadmin")`                                                                                                                                                 | —                        |
| `admin-users`   | `GET /superadmin/users`, `PATCH /superadmin/users/:id/role` — `@Roles("superadmin")`                                                                                                                                                                             | —                        |
| `users`         | `GET /users/me/stats` (aggregates over GameResultEntry)                                                                                                                                                                                                          | —                        |
| `duel`          | see [duels.md](duels.md)                                                                                                                                                                                                                                         | GameEngine               |
| `realtime`      | (gateway, no HTTP)                                                                                                                                                                                                                                               | GameEngine, Duel         |
| `game-engine`   | (no HTTP)                                                                                                                                                                                                                                                        | Redis store, Prisma      |

Conventions: controllers are thin; ownership/authz and business rules live in
services; DTO validation via class-validator (`dto/` folders). Errors are
thrown as Nest `HttpException`s from services.

## Quiz & question authoring

- `quizzes.service.ts` — plain CRUD with `userId` ownership checks.
  `update()` runs in a transaction: flipping `isPublic: true` also moves every
  `draft` question to `pending` (submits them for moderation; already-decided
  ones untouched).
- `questions.service.ts` — the multipart upsert (`upsertFromMultipart`) is the
  single write path for questions from the UI (create and edit, fields
  `option1..4` + `choose_option` a–d, optional file → Cloudinary upload,
  replacing media destroys the old asset). Order maintenance: `reorder` is
  insert-at-position with shift-by-one `updateMany`s; `delete` closes the gap.
  **Any edit resets `moderationStatus` (public → `pending`), zeroes
  `reportCount`, and deletes existing reports** — approval never survives a
  content change.
- `POST /quizzes/ai` (`createWithAi`): prompt → `gemini-3.5-flash` → strict
  text format parsed by `parseQuestions` (4 options, first is correct, then
  shuffled). Timeouts → 503, other API failures → 502, under-generation → 400. Whole quiz insert is one transaction. Requires `GEMINI_API_KEY`.

## Moderation

`moderation.service.ts` — the gate feeding the duel pool
([duels.md](duels.md#question-pool)):

- States: `draft` (private) → `pending` (public, awaiting review) →
  `approved` | `unapproved`. Only `approved` questions in public quizzes enter
  the duel pool.
- Queue = `pending` ∪ (`unapproved` with `reportCount > 0`), most-reported
  first, cursor-paginated.
- `reportQuestion` (any account, `report` rate profile): only `approved`
  questions are reportable; one report per user enforced by the DB unique
  constraint (duplicate → idempotent no-op); the 6th **distinct** reporter
  (`reportCount > 5`) auto-unapproves. Approve/unapprove resets count and
  deletes reports.

## Classic room administration (HTTP mirror of socket controls)

`game-sessions.service.ts` — read alongside the socket paths in
[realtime.md](realtime.md#kick--ban-semantics):

- `join`: banned-check first, then a **serializable transaction** so
  concurrent joins can't overshoot the host's `hostSizeLimit`; rejoining the
  same room bypasses the cap.
- `endRoom` / `removePlayerFromRoom` / `banPlayerFromRoom`: host-only; they
  drive the engine (broadcasts included) and then reconcile Postgres. Ban
  order (Redis ban **before** Postgres detach) is deliberate — a join between
  the two would otherwise readmit the player. A detached-but-not-cleaned
  player is still kickable so retries can finish a partial failure.
- `getResult`: hosted results visible to the host; hostless (duel) results
  only to participants.

Answers have **no REST surface** — `submit-answer` over the socket (with an
ack) is the only way in, because scoring needs the server-measured time
between the question opening and the answer landing.

## Cross-cutting services (`src/common/`)

- `CloudinaryService` — `uploadBuffer` / `destroyIfPresent`; config from env;
  optional feature (no creds → uploads fail, nothing else breaks).
- `RateLimitService`/Guard — see [auth.md](auth.md#rate-limiting-adjacent-concern).
- Utils: `compute-score.ts` (1000→100 decay), `elo.ts`, `duel-bot.ts`,
  `parse-cors-origin.ts`.

## Adding an endpoint (the house pattern)

1. DTO with class-validator in the module's `dto/`.
2. Controller method — pick identity decorator (`@CurrentAccountUser()` /
   `@CurrentPlayerUser()`), add `@Public()`/`@Roles()`/`@UseGuards(RateLimitGuard)`
   as needed.
3. Service does ownership checks + Prisma work; throw Nest HttpExceptions.
4. Mirror it in the web client: `apps/web/src/lib/modules/<domain>/api.ts` +
   `hooks.ts`, key in `query-keys.ts` ([frontend.md](frontend.md)). Response
   types there are **hand-written mirrors** (no codegen, no shared types
   package for REST payloads) — when you change a response shape, update the
   mirror or nothing fails until runtime.
