# Current project context

Snapshot of where Buzrr stands. **Last verified against the code:
2026-10-06**, through the Phase 0 architecture change (question types, pure
engine core, shared contract, self-hosting); sections not touched by it were
last checked 2026-09-14. Update this file when the picture changes; keep
it about the present, not a changelog.

## Where the project is

Public beta. The hosted version now has a paid **Buzrr Pro** plan (Dodo
Payments, ADR-010); self-hosted instances run with billing off and Pro limits. Both flagship modes work end-to-end: classic
hosted rooms (join by code/link/QR, kick/ban, host-abandon cleanup) and 1v1
duels (ELO matchmaking, bot fallback, unrated friend invites). Supporting
features shipped: AI quiz generation, question moderation + roles, profile
stats/history, health endpoint, Vercel Analytics.

## Recent architectural moves (still fresh, know they exist)

- **Phase 0 — architecture that makes later features cheap** (2026-10):
  - **Pluggable question types** (ADR-011): `Question.type` + `config`
    (migration `20261006000001`); one pure server handler + one web renderer
    per type; the socket contract is type-agnostic (`submit-answer
{ qIndex, answer }`, `question-end.summary`). Only `multiple_choice`
    exists.
  - **Pure engine core** (ADR-012): `step(state, event, now) → { state,
effects }` in `game-engine/core/`, unit-tested; `GameEngineService` is
    the I/O shell. **Pacing is a strategy** (`hostPaced`, `autoAdvance`).
  - **`@buzrr/contract`** (ADR-013): zod schemas both apps import; the
    hand-kept `socket-events.ts` mirror is gone.
  - **Self-hosting** (ADR-014): `docker compose up` runs the whole stack
    offline; media behind `MediaStorage` (local / S3-compatible /
    Cloudinary), models behind an OpenAI-compatible interface (Nest +
    `apps/ai`), optional local email + password accounts; `yarn setup` now
    starts only `postgres redis`. CI boots the stack (`self-host` job).
  - Fixed on the way: a question-phase `state-sync` no longer reveals whether
    the player's stored answer was correct.

- **Buzrr Pro (billing & entitlements)** — Dodo Payments subscriptions:
  - **Limits:** Free is 50 players, 10 quizzes, 3 lifetime AI generations.
    Pro is 250 players, unlimited quizzes, 10 AI generations per week.
  - **Plans** are derived per request from `subscriptions`.
  - **Webhooks** are verified in `apps/web`, then re-verified and applied by
    `apps/server/src/modules/billing` from Dodo-fetched state.
  - **`apps/ai`** reserves AI tokens through Nest.
  - **Rollout:** off unless `BILLING=ON`; migration `20260914000001` needs
    `migrate:deploy`. See ADR-010.
- **Server-authoritative rewrite** (PR #17): engine + Redis live state +
  state-sync contract — the defining refactor; see ADR-002.
- **Moderation & roles** (PR #18), **beta room cap** `hostSizeLimit` (#25),
  **kick/ban** (#35), **friend invites** (#34), **health check** (#37),
  **duel bots** (#39 — current HEAD).
- **Buzrr-AI (`apps/ai`)** — new Python 3.12 + FastAPI service with an arq
  worker: Knowledge Spaces, PDF/DOCX/TXT/MD ingestion, pgvector retrieval and
  cited quiz-question generation, exported into real quizzes via the new
  `POST /api/quizzes/import`. Optional (hidden when `NEXT_PUBLIC_AI_API_URL` is
  unset). Local/CI Postgres moved to `pgvector/pgvector:pg16`. See ADR-009 and
  `docs/architecture/ai.md`.
- **Legacy contract retired**: the v1 socket dual-emits/aliases, the
  `POST /:id/answers` fallback route and the vestigial
  `GameSession.gameState`/`currentQuestion` columns are gone. The socket
  contract now has exactly one version. See the ADR-002 amendment; migration
  `20260814000001` must be applied with `migrate:deploy` in production.

## In transition / incomplete (verified in code)

1. **vinext/Vite parallel toolchain** — present, non-default, end-state
   unknown (ADR-008).
2. **Question types beyond multiple choice** — the plumbing is done, but the
   question editor (`AddQuesForm`) still authors only 4-option multiple
   choice (the API already takes `type`/`config`/`options`), and no second
   type exists yet.
3. **Self-paced pacing** — planned; needs per-player question state the
   phase machine doesn't model yet (ADR-012).
4. **REST validation is half on the contract** — `POST /quizzes/import` uses
   the zod contract; other endpoints still use class-validator DTOs and
   hand-mirrored web response types.
5. **Dodo dashboard configuration lives outside the repo.** The Pro product,
   its ₹399 INR localized price and pricing mode,
   any product-level discount, the Adaptive Currency setting, the webhook endpoint and events, and the
   recovery/portal settings are set by hand (checklist in ADR-010). Live prices and the
   promotion are read from Dodo; `apps/web/src/lib/pricing.ts` and the server's
   `FALLBACK_PRO_PRICE` are only fallbacks.

## Known debt & risks (grounded, ranked by blast radius)

1. **Thin automated test coverage around the engine's edges.** The pure
   core (phase machine, judging, snapshots, pause/forfeit decisions) and the
   question-type, storage and LLM adapters now have vitest specs, alongside
   billing. Still untested: the I/O shell (`GameEngineService`), the
   Lua-scripted races in `GameStoreService`, ELO persistence, matchmaking and
   invites — exercised only end to end. `apps/web` has no tests at all
   (including the Dodo webhook forwarder). `apps/ai` has its own pytest suite.
2. **Redis is a single point of failure** for all realtime + matchmaking;
   the server won't boot without it. No degraded mode. It now also carries
   Buzrr-AI's ingestion queue, so an outage degrades two subsystems (AI
   ingestion is async and retryable, so it degrades more gracefully).
3. **In-memory grace timers** (lobby removal 60s, duel forfeit 30s) die with
   their instance. Duel forfeits are re-derived from the roster's `lastSeenAt`
   by the sweeper (`sweepDuelForfeits`) and classic has the host-abandon sweep,
   so a crash delays those by up to a sweep tick rather than skipping them.
   **Lobby removal still has no backstop.**
4. **CORS defaults open**: unset `WEB_ORIGIN` reflects any origin; prod must
   set it (documented in `.env.example`).
5. **Player row growth**: guest identities are never deleted (by design,
   ADR-005) and there is no cleanup job.
6. **AI quiz output relies on provider schema support**: `POST
/api/quizzes/ai` uses structured output (`TextGenerator.generateJson`,
   JSON Schema from a zod schema) and re-validates the reply. Local
   OpenAI-compatible servers that ignore `response_format: json_schema`
   still fail safe (502), but less often than the old text parser did.
7. **7-day stateless JWTs**: sign-out/demotion doesn't invalidate minted
   tokens; role checks re-read the DB (mitigates authz), identity itself
   remains valid until expiry.
8. **Host-screen roster state is triplicated** (REST lobby snapshot,
   `playersSlice`, `game.players`) — coherent today but easy to desync when
   editing lobby UI.
9. **Refunds and lost disputes don't revoke Pro automatically.** Access follows
   Dodo's subscription status; `refund.succeeded` / `dispute.lost` are only
   logged for manual review.
10. **The migration history has no baseline.** It can't build an empty
    database (the first migration alters `users`); fresh installs rely on
    `packages/prisma/scripts/deploy.mjs` (`db push` + mark-all-applied).
    Any future migration must be correct **both** on top of production and
    as a no-op after a `db push` of the schema it targets.
11. **The first superadmin is bootstrapped by a migration that hard-codes the
    maintainer's email** (`20260714000001`). Self-hosted installs (baselined,
    so that SQL never runs) must promote themselves by hand
    (docs/self-hosting.md).
12. **Local accounts have no password reset** (no mail on offline installs).
13. **Crash recovery waits out the owner lock**: a restarted instance can't
    fire a game's deadlines until the dead one's 20s lock lapses, so a live
    question can stall ~20–30s after a crash (measured ≈29s).

## Active development areas (inferred from recent PR cadence)

Duel-mode depth (bots were last), host quality-of-life (kick/ban, room caps),
and UX polish. There is no public roadmap; planned work lives in GitHub issues.

## Operational facts worth knowing

- Local dev needs Docker; `yarn setup` is idempotent and self-healing, and
  starts only `postgres` + `redis` — `docker compose up` alone is the
  self-hosted stack (ports 3000/3001, clashes with `yarn dev`).
- Prod DB changes go through committed migrations (`migrate:deploy` from
  `packages/prisma`); the repo's migrations are the schema history.
- The duel pool can be legitimately empty (moderation gate) — seed with
  `yarn workspace @buzrr/prisma seed:duel` if duels error with
  "No duel questions". The self-host `migrate` container seeds it on start.
- MinIO no longer publishes pullable Docker images; S3 support was verified
  against SeaweedFS, and the compose stack defaults to local disk.
