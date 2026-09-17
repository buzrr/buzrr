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
