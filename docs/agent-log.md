# Agent change log — meaningful architectural changes only

One line per **architecturally meaningful** change made by a coding agent (or
human, if they like): date · PR/commit if known · what changed at the
architecture level. Newest first.

**Log it only if** it changed architecture, data flow, service boundaries,
schema (Postgres or Redis keys), the socket contract, auth, infrastructure,
or an invariant — i.e. the same test that requires a docs update in
[AGENTS.md](../AGENTS.md#how-agents-must-maintain-these-docs). Bug fixes,
styling, copy, and mechanical refactors do **not** belong here. Keep entries
to one or two lines; details go in the architecture docs/ADRs the entry
points to.

Format:

```text
- YYYY-MM-DD (PR#/commit) — summary. Docs touched: file, file / ADR-NNN.
```

## Entries

- 2026-09-18 — Answer window is stamped into meta **before** `question-start` goes out (was: broadcast first, stamp after), and the per-socket RTT credit is gone — `latency-probe`/`monitorLatency` removed from the socket contract, and `ANSWER_GRACE_MS` is now a flat allowance that accepts late-arriving answers at deadline score. Docs touched: realtime.md, invariants.md, ARCHITECTURE.md.
- 2026-09-16 — Answer window stamped after `question-start` is broadcast; per-socket RTT probe (`latency-probe`, rolling median) credits half the round trip; 300ms grace past the real deadline; clients receive `remainingMs` instead of `deadline`/`serverNow`/`startAt`. Docs touched: realtime.md, invariants.md, frontend.md, ARCHITECTURE.md.
- 2026-09-14 — Pricing docs aligned with the configured Dodo product: ₹399 INR localized price (fallbacks set to 39900), `by_currency`/`by_country` both supported, product-level discount shown, Adaptive Currency caveat. Docs: ADR-010, infrastructure.md, CONTEXT.md.
- 2026-09-14 — Pricing shows INR for India / USD elsewhere as the headline price, read live from the Dodo product (`GET /api/billing/pricing`); Dodo discount codes: auto-applied promotion (`DODO_PROMO_DISCOUNT_CODE`) plus customer-entered codes validated server-side. Docs: backend.md, frontend.md, infrastructure.md, ADR-010, CONTEXT.md.
- 2026-09-14 — Buzrr Pro: Dodo Payments subscriptions, a Nest `billing` module (entitlements, webhook apply, checkout/portal, AI token ledger), Next.js `/api/webhooks/dodo` forwarder plus pricing/checkout/success/billing pages, plan enforcement for the quiz cap, room cap and AI generations (including Buzrr-AI via Nest), and migration `20260914000001`. Added the first vitest suite to `apps/server`. Docs touched: ADR-010 (new), data.md, backend.md, auth.md, frontend.md, infrastructure.md, ai.md, invariants.md (#23/#28/#31 amended, #36–39 new), CONTEXT.md, AGENTS.md. Also added the missing ADR-009 row to the ADR index.
- 2026-08-18 (7440e2d) — Added **`apps/ai`** (Buzrr-AI): a FastAPI + arq service for Knowledge Spaces, document ingestion and cited RAG quiz generation, on a new Alembic-owned `ai` Postgres schema (pgvector) and an `ai:*` Redis prefix, reaching real quizzes only via `POST /api/quizzes/import` on Nest. Docs touched: ai.md (new), ADR-009 (new), overview.md, data.md, auth.md, backend.md, frontend.md, infrastructure.md, invariants.md (#30–#35), ARCHITECTURE.md, AGENTS.md, CONTEXT.md.
- 2026-08-16 (28aa264 + follow-up) — Duels now **pause** while no human is
  connected (`pausedAt` in game meta, parked deadline, `pauseDuel`/`resumeDuel`,
  both transitions claimed via Lua compare-and-set) instead of letting a bot
  play the match out during the forfeit grace, and the sweeper gained
  `sweepDuelForfeits`, which re-derives an overdue forfeit from the roster's
  `lastSeenAt` — covering duels whose opponent stayed connected, which no
  longer depend on an in-memory timer surviving. `enterReveal` also emits
  personal `answer-result`s before the room's `question-end`. Docs touched:
  realtime.md, duels.md, CONTEXT.md.
- 2026-08-14 — Retired the legacy v1 compatibility layer: engine dual-emits,
  gateway v1 host-intent aliases, `POST /game-sessions/:id/answers` (+ DTO,
  `submitAnswerCurrent`), and the vestigial `GameSession.gameState` /
  `currentQuestion` columns and `GameStates` enum (migration
  `20260814000001`). Socket contract is now single-version. Docs touched:
  realtime.md, backend.md, data.md, auth.md, frontend.md, invariants.md
  (#26 inverted), CONTEXT.md, ADR-002 (amended). Also extracted the
  architecture write-up out of README into a root
  [ARCHITECTURE.md](../ARCHITECTURE.md) (linked from README/AGENTS/CLAUDE).
- 2026-08-14 — Documentation system created from a full codebase audit
  (AGENTS.md, docs/architecture/\*, docs/adr/001–008, CONTEXT.md, this log).
  No application code changed.
- 2026-10-01 — SEO/GEO layer: `(marketing)` static pages, `lib/seo`, sitemap/robots/OG routes, www canonical, and public routes now server-render past `PersistGate` (frontend.md § SEO).
- 2026-10-06 — Phase 0 architecture: pluggable question types (ADR-011), pure engine core + pacing strategies (ADR-012), `@buzrr/contract` replacing the hand-kept socket mirror (ADR-013), self-hosting via `docker compose up` with storage/model/sign-in abstractions and baselined migrations (ADR-014, docs/self-hosting.md). Updated ARCHITECTURE, AGENTS, CONTEXT, README, CONTRIBUTING and realtime/data/backend/frontend/auth/ai/infrastructure/duels/overview/invariants (#1, #18, #25 rewritten; #40–45 added). Doc drift fixed on the way: duels.md bot accuracy (easy is 30%, not 45%), overview.md "no test suite".
- 2026-10-12 — Fixed stale-socket presence (a reconnected player/host was marked gone when their old socket closed, triggering early question closes) and stale `state-sync` overwriting newer state on clients; added `apps/web` vitest + CI step, shortened Socket.IO ping. Updated realtime.md, frontend.md, infrastructure.md, AGENTS, CONTEXT, CONTRIBUTING.
- 2026-10-12 — Per-answer Redis cost cut from 10 commands + 1 PUBLISH to 4 + 1 (shared pipelined read, `recordAnswer` Lua script, `answer-recorded` carries answered ids); added opt-in real-Redis `answer-cost.spec.ts` (`REDIS_TEST_URL`, set in CI). Updated realtime.md, invariants.md, data.md, infrastructure.md, ADR-012.
- 2026-10-14 — Question types from the "Buzrr Question Types" design: true/false, poll, word cloud, rating, open text, multi-correct multiple choice; handler `scored`/`duelEligible`, host-only throttled `live-summary` event, duel eligibility drives moderation status and the duel pool; type-aware editor, Add Question type menu and per-type cards. Updated ADR-011, realtime.md, backend.md, CONTEXT, CONTRIBUTING.
- 2026-10-14 — Multiple submissions for word cloud / open text: optional handler `acceptsMoreAnswers`/`mergeAnswers`, compare-and-set `replaceAnswer`, no early close for such questions, `submit-answer` ack returns the stored answer. Updated realtime.md, ADR-011.
- 2026-10-15 — 1v1 Duel redesign (Claude Design "Buzrr 1v1 Duel"): duel categories with per-category ratings and category matchmaking, standalone questions (nullable `quizId`, `createdById`, admin `POST /api/questions`), many-to-many question categories, daily duel streak with calendar (ADR-015, migration `20261015000001`). Updated data.md, duels.md, backend.md, frontend.md, invariants #20, ADR-007, CONTEXT.
- 2026-10-18 — True / false stores its answer as `Question.config.answer` with no `Option` rows; answer `{ value }`, summary `trueCount`/`falseCount`/`answer`; legacy option pairs still accepted; data migration `20261018000001`. Fixes ✓/✗ drawn on the wrong option. Updated ADR-011, data.md, backend.md, CONTEXT.
- 2026-10-18 — Dense ranking (ties share a rank, zero-score players ranked) in `buildLeaderboard`/`buildAnswerResult` and the host podium; the question-phase snapshot carries the rank as of the last reveal; the player screen shows a standing strip on phones and a rank chip while answering. Updated realtime.md, invariants #18.
- 2026-10-18 — Server deploy to EC2: `deploy-server.yml` (after CI on main → GHCR image → SSH `docker compose pull/up`) and `deploy/ec2/` stack (migrate + server + Caddy, external Postgres/Redis). Updated infrastructure.md.
- 2026-10-19 — Option order is now authored order: every option write stamps `createdAt` one ms apart (`common/utils/option-order.ts`) and every read orders by it, so the editor's answer drag/shuffle and the AI's shuffle reach players. Updated data.md.
- 2026-10-20 — Game report: classic results keep per-question stats (`GameResultQuestion`, `questionStats`, migration `20261020000001`); the leaderboard view has Standings / Questions tabs and CSV downloads. "Play alone": tests over REST outside the room engine (ADR-016, `modules/solo`, `/solo/[code]`, migration `20261020000002`); `Question` takes an answer sender instead of a socket. AI quizzes: the quiz title goes into the prompt, a host-chosen mix of multiple choice / true-false / type-answer, a server-side check that drops questions giving their answer away, and an agentic review that rewrites weak questions (two rounds). Updated ADR-012, realtime.md, data.md, ARCHITECTURE.md, CONTEXT.
- 2026-10-20 — Draining for rolling deploys: `GET /health/ready`, loopback `POST /health/drain` → `GameEngineService.runningHere()`, preStop `apps/server/scripts/drain.mjs` waits until no game runs on the old instance; `VersionWatcher` defers its reload until the game reaches the final standings. Updated realtime.md, infrastructure.md, backend.md.
- 2026-10-20 — "Play alone" plays the quiz's sounds unless they're off (`GameSounds solo`, own mute pref; `SoloTestInfo.sound`; test players may load the host's skin). AI variety: leak checks match word stems, a question may not name another's answer, a subject in at most two questions. Numeric slider tick labels set their own value. Updated backend.md.
- 2026-10-23 — "Host quiz" opens a settings dialog (pre-filled from the quiz, shared `QuizSettingsFields` with the editor): per-game overrides on `GameSession.settings` (migration `20261023000001`), optional save as the quiz's default; the server resolves a room's settings through `roomSettings`. Body is contract `createGameSessionSchema`. Updated data.md, backend.md, realtime.md.
- 2026-10-23 — Documented the UI language system (`src/lib/i18n`, German dictionary keyed by English text) in frontend.md.
