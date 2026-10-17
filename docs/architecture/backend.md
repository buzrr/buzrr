# Backend (NestJS) — modules, REST surface, conventions

`apps/server` is one NestJS 11 process: Express HTTP under global prefix
`/api` + Socket.IO on the same port. Realtime specifics live in
[realtime.md](realtime.md); auth/guards in [auth.md](auth.md). This file
covers everything else.

## Bootstrap (`src/main.ts`)

Order matters: `NestFactory.create` with `rawBody: true` (Dodo webhook
signatures are over the exact bytes) → shutdown hooks → `TRUST_PROXY` handling → `RedisIoAdapter` →
CORS (`WEB_ORIGIN` via `parseCorsOrigin`, credentials on) → global prefix
`api` (excluding `health`) → global `ValidationPipe({ transform: true,
whitelist: true, forbidNonWhitelisted: false })` → global
`AllExceptionsFilter` (HttpExceptions pass through with status; everything
else becomes a logged 500) → with `STORAGE_DRIVER=local`, static serving of
`/uploads/*` from the upload directory (`nosniff`, immutable caching). Port:
`API_PORT` ?? `PORT` ?? 3001.

## Module map (`src/app.module.ts`)

Global modules: `ConfigModule`, `RedisModule` (3 ioredis clients),
`CommonModule` (guards/services), `PrismaModule`. Feature modules:

| Module           | Controller routes (all under `/api`)                                                                                                                                                                                                                                                                                                                                                                             | Depends on                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `health`         | `GET /health` (no prefix) — pings Postgres + Redis with 2s timeouts; 503 if either is down                                                                                                                                                                                                                                                                                                                       | Prisma, REDIS                            |
| `players`        | `POST /players` (mint guest + player JWT), `PATCH /players/name`, `GET /players/:id`, `PATCH /players/:id/clear-game` — all `@Public()` + rate-limited                                                                                                                                                                                                                                                           | own JwtModule                            |
| `game-sessions`  | `POST /game-sessions` (create room), `POST /join`, `GET /player-play/:playerId` (public), `GET /history`, `GET /results/:resultId`, `GET /:roomId/lobby`, `POST /:roomId/end`, `DELETE /:roomId/players/:playerId` (kick), `POST /:roomId/players/:playerId/ban`                                                                                                                                                 | GameEngine, Billing                      |
| `quizzes`        | CRUD `/quizzes`, `POST /quizzes/ai` (`TextGenerator`; `ai` rate profile; spends an AI token), `POST /quizzes/import` (batch import from Buzrr-AI; body = contract `importQuizSchema`)                                                                                                                                                                                                                            | TextGenerator, question types, Billing   |
| `questions`      | `POST /questions` (standalone/bulk, no quiz; admin-only; body = contract `createStandaloneQuestionsSchema`), `PATCH /questions/reorder`, `DELETE /questions/:id`, `POST /questions/:id/report`; plus `QuizQuestionsController`: `GET/POST /quizzes/:quizId/questions` (multipart upsert; media via `MediaStorage`)                                                                                               | MediaStorage, question types, Moderation |
| `moderation`     | `GET /moderation/questions?status=pending\|approved\|unapproved`, `GET .../counts`, `PATCH .../approve` · `.../unapprove` · `.../pending` · `.../categories` (bulk, `{ ids }` ≤100; skipped ids reported back), `PATCH .../:id/approve`, `PATCH .../:id/unapprove`, `PATCH .../:id/pending` (back to review), `PATCH .../:id/categories` (retag; no re-moderation) — `@Roles("admin","superadmin")`              | Categories                               |
| `categories`     | `GET /categories` (any account — the list with question counts), `POST`/`PATCH`/`DELETE /categories[/:id]` (`@Roles("admin","superadmin")`; delete cascades tags + per-category ratings); `CategoriesService.assertExist` validates `categoryIds` on admin writes. **Only admins tag questions** (standalone create + moderation endpoints); quiz question saves and `POST /quizzes/import` ignore `categoryIds` | —                                        |
| `admin-users`    | `GET /superadmin/users`, `PATCH /superadmin/users/:id/role` — `@Roles("superadmin")`                                                                                                                                                                                                                                                                                                                             | —                                        |
| `users`          | `GET /users/me/stats` (aggregates over GameResultEntry)                                                                                                                                                                                                                                                                                                                                                          | —                                        |
| `billing`        | `GET /billing/me`, `POST /billing/checkout`, `POST /billing/portal`, `POST /billing/sync` (`report` rate profile), `POST /billing/ai-tokens/reserve` + `/release` (called by Buzrr-AI with the caller's JWT), `POST /billing/webhooks/dodo` (`@Public()`, Dodo signature) — see [Billing](#billing--entitlements-srcmodulesbilling)                                                                              | Dodo SDK                                 |
| `duel`           | see [duels.md](duels.md)                                                                                                                                                                                                                                                                                                                                                                                         | GameEngine                               |
| `realtime`       | (gateway, no HTTP)                                                                                                                                                                                                                                                                                                                                                                                               | GameEngine, Duel                         |
| `game-engine`    | (no HTTP) — pure core in `core/`, shell in `game-engine.service.ts` ([realtime.md](realtime.md))                                                                                                                                                                                                                                                                                                                 | Redis store, Prisma                      |
| `question-types` | (no HTTP, no Nest module) — pure handler per type + `registry.ts`; used by the engine, `questions`, `quizzes`, the duel pool ([ADR-011](../adr/011-pluggable-question-types.md))                                                                                                                                                                                                                                 | `@buzrr/contract`                        |

Conventions: controllers are thin; ownership/authz and business rules live in
services; DTO validation via class-validator (`dto/` folders), or — for
bodies defined in `@buzrr/contract` — `@Body(new ZodValidationPipe(schema))`
(`common/pipes/zod-validation.pipe.ts`; the global `ValidationPipe` skips
such plain-typed params). Errors are thrown as Nest `HttpException`s from
services.

## Quiz & question authoring

- `quizzes.service.ts` — plain CRUD with `userId` ownership checks. Every
  quiz-creating path (`create`, `importQuestions`, `createWithAi`) calls
  `EntitlementsService.assertQuizCapacity` inside its insert transaction.
  `update()` runs in a transaction: flipping `isPublic: true` also moves every
  duel-eligible `draft` question to `pending` (submits them for moderation)
  and every other draft to `unapproved`; already-decided ones are untouched.
- `questions.service.ts` — the multipart upsert (`upsertFromMultipart`) is the
  single write path for questions from the UI (create and edit). Fields:
  `type` (default `multiple_choice`), optional `config` (JSON), and options
  as either an `options` JSON array of `{ title, isCorrect }` or the original
  legacy `option1..4` + `choose_option` a–d fields (the editor now sends the
  JSON form; types without options send `[]`). Options + config go
  through the type's `validateDefinition` (its `QuestionDefinitionError`
  becomes a 400). Optional file → `MediaStorage.upload`; replacing media
  removes the old object (drivers ignore URLs they didn't issue). Order maintenance: `reorder` is
  insert-at-position with shift-by-one `updateMany`s; `delete` closes the gap.
  **Any edit resets `moderationStatus` (public → `pending`, or `unapproved`
  when the type's `duelEligible` says duels can't play it), zeroes
  `reportCount`, and deletes existing reports** — approval never survives a
  content change.
- `POST /quizzes/import` (`importQuestions`): the contract's `importQuizSchema`
  fixes the envelope; each question (no `type` → multiple choice) is checked
  by its type's handler, and a failure names the question (`Question 3: …`).
- `POST /quizzes/ai` (`createWithAi`): prompt → the configured
  `TextGenerator.generateJson` (Gemini `responseSchema`, or OpenAI-compatible
  `response_format: json_schema`) with a JSON Schema derived from the zod
  `aiQuizOutputSchema` (`question`, `correctAnswer`, three `wrongAnswers`);
  the reply is re-validated with the same schema, blank/duplicate-option
  questions are dropped, options shuffled. The prompt asks for short options
  (≈1–5 words, ≤60 chars) so players can read them in time. Timeouts → 503,
  other failures or off-schema output → 502, under-generation → 400,
  no model configured → 400. Whole quiz insert is one transaction. Reserves
  one AI token before generating; any failure refunds it.

## Moderation

`moderation.service.ts` — the gate feeding the duel pool
([duels.md](duels.md#question-pool)):

- States: `draft` (private) → `pending` (public, awaiting review) →
  `approved` | `unapproved`. Only `approved` questions in public quizzes — or
  **standalone** questions (no quiz), which skip `draft` and start `pending`
  — enter the duel pool. The queue labels standalone rows "Standalone ·
  author" (`createdBy`).
- Ownership of a question is `Question.createdById` (falling back to
  `quiz.userId` for rows without one); standalone creation is admin-only
  because plan limits count quizzes, not questions.
- Only **duel-eligible** questions are reviewed: single-answer multiple choice
  and true / false (`isDuelEligible` in the question-type registry). Others
  in a public quiz go straight to `unapproved` (so they never fill the queue),
  `approve` refuses them with a 400, and the duel pool SQL filters on type
  and, for multiple choice, a single correct option as a last guard (true /
  false has no options; its key is `config.answer`).
- The admin list is one tab per status (`?status=`, default `pending`;
  `draft` is never listed), cursor-paginated: pending oldest first,
  unapproved most-reported first (auto-unapproved questions surface there),
  approved newest first. `GET .../counts` feeds the tab badges.
- Bulk approve / unapprove / retag (`transitionDecisions`,
  `bulkSetCategories`) are set-based and never fail the batch on a bad id:
  missing ids and (for approve / pending) non-duel-eligible questions come back in
  `skipped`. Retag modes: `add` (skips a question that would pass 5
  categories), `remove`, `replace`. The single-id endpoints call the same
  code and keep their 404 / 400.
- `reportQuestion` (any account, `report` rate profile): only `approved`
  questions are reportable; one report per user enforced by the DB unique
  constraint (duplicate → idempotent no-op); the 6th **distinct** reporter
  (`reportCount > 5`) auto-unapproves. Approve/unapprove resets count and
  deletes reports.

## Classic room administration (HTTP mirror of socket controls)

`game-sessions.service.ts` — read alongside the socket paths in
[realtime.md](realtime.md#kick--ban-semantics):

- `join`: banned-check first, then a **serializable transaction** so
  concurrent joins can't overshoot the host's plan cap (`maxPlayersFor`: 50 Free / 250 Pro, or a
  higher `hostSizeLimit` override); rejoining the
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

## Billing & entitlements (`src/modules/billing/`)

Buzrr Pro — see [ADR-010](../adr/010-billing-and-entitlements.md). It is off
unless `BILLING=ON` (`billing.config.ts`); when off, every account gets Pro
limits and billing routes return 503.

- **`plans.ts`** — the only table of limits:
  - Free: 50 players, 10 quizzes, 3 lifetime AI generations.
  - Pro: 250 players, unlimited quizzes, 10 AI generations per rolling week.
- **`entitlements.service.ts`** — the single authority, exported to the
  quizzes and game-sessions modules:
  - `resolvePlan` reads `subscriptions` on every call, never the JWT. Pro
    means `active`, or `cancelled` with `cancelAtPeriodEnd` inside the paid
    period.
  - `assertQuizCapacity(tx, userId)` locks the user row
    (`SELECT … FOR UPDATE`), then counts. Call it inside the transaction that
    creates the quiz.
  - `maxPlayersFor(userId, tx)` returns `max(plan cap, hostSizeLimit)`.
  - `reserveAiToken` / `releaseAiToken`: each spend is one conditional
    `UPDATE`. A refund needs the reservation's release token, is idempotent,
    and never lands in a newer Pro window.
  - Refusals are `403 { code: "PLAN_LIMIT", limit: "quizzes" | "ai_tokens",
max, resetsAt? }`; the web client's upgrade prompt keys on that body.
- **`billing.service.ts`**:
  - Hosted checkout. `metadata.userId` is set server-side; a live subscription
    returns 409 `ALREADY_SUBSCRIBED`.
  - Customer portal.
  - `syncForUser` — the success-page fallback that pulls this account's
    subscriptions straight from Dodo.
- **`pricing.service.ts`** — `GET /billing/pricing` (`@Public()`) quotes Pro
  through Dodo's **checkout preview** for the region's billing country (`IN`,
  or `US` for everyone else), so the localized price, any product-level
  discount and the promotion named by `DODO_PROMO_DISCOUNT_CODE` come out
  exactly as checkout will charge them (cached 5 min; `FALLBACK_PRO_PRICE` if
  Dodo is unreachable). `POST /billing/discounts/validate` (`report` rate
  profile) checks a customer-typed code the same way; checkout sends that code
  or the promotion as `discount_codes`, retrying at full price if Dodo refuses
  the promotion for that customer.
- **Webhooks.** `apps/web`'s `/api/webhooks/dodo` verifies the event and
  forwards the raw body to `billing-webhook.controller.ts` (`@Public()`, reads
  `req.rawBody`). `BillingWebhookService.handle` then:
  1. Re-verifies the signature (401 on failure).
  2. Ignores event types it doesn't handle.
  3. In one transaction: inserts the `billing_events` claim (a duplicate is a
     no-op), takes the advisory lock, calls `subscriptions.retrieve`, runs
     `SubscriptionSyncService.apply`, and upserts `payments`.

  If Dodo is unreachable it returns 503, so Dodo redelivers. Refunds and lost
  disputes are only logged for review; access follows the subscription status.

- **Tests:** `__tests__/` (vitest, real Postgres), run with
  `yarn workspace server test`.

## Cross-cutting services (`src/common/`)

- `MediaStorage` (`storage/`) — where question images go: `cloudinary`, `s3`
  (any S3-compatible store; built-in SigV4 signer) or `local` (API disk,
  served at `/uploads`), or `none`. Chosen by `STORAGE_DRIVER`; unset =
  Cloudinary if `CLOUDINARY_CLOUD_NAME` is set, else `none` — never a silent
  fall back to disk. `none` rejects uploads with 503 "Media upload is currently unavailable"; it is
  also bound when `CLOUDINARY_*` or `S3_BUCKET`/`S3_ACCESS_KEY_ID`/
  `S3_SECRET_ACCESS_KEY` are incomplete. `s3`/`local` accept only
  magic-byte-sniffed PNG/JPEG/GIF/WebP/AVIF (no SVG — they serve bytes as-is).
  Only an unknown `STORAGE_DRIVER` fails at boot.
- `TextGenerator` (`llm/`) — prompt in, text out: `GeminiGenerator` or
  `OpenAICompatibleGenerator` (plain `fetch` to `/chat/completions`). Chosen
  by `LLM_PROVIDER` / `LLM_BASE_URL`; `configured` is false with nothing set,
  and AI generation then answers 400 instead of failing at boot.
- `RateLimitService`/Guard — see [auth.md](auth.md#rate-limiting-adjacent-concern).
- Utils: `compute-score.ts` (1000→100 decay), `elo.ts`, `duel-bot.ts`,
  `parse-cors-origin.ts`.

## Adding an endpoint (the house pattern)

1. Body validation: a schema in `@buzrr/contract` + `ZodValidationPipe` when
   the web client also needs the shape, otherwise a class-validator DTO in the
   module's `dto/`.
2. Controller method — pick identity decorator (`@CurrentAccountUser()` /
   `@CurrentPlayerUser()`), add `@Public()`/`@Roles()`/`@UseGuards(RateLimitGuard)`
   as needed.
3. Service does ownership checks + Prisma work; throw Nest HttpExceptions.
4. Mirror it in the web client: `apps/web/src/lib/modules/<domain>/api.ts` +
   `hooks.ts`, key in `query-keys.ts` ([frontend.md](frontend.md)). Only the
   bodies defined in `@buzrr/contract` are shared; other response types there
   are **hand-written mirrors** — when you change one of those, update the
   mirror or nothing fails until runtime.
