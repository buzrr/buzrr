# Current project context

Snapshot of where Buzrr stands. **Last verified against the code:
2026-08-14**, through PR #39. Update this file when the picture changes; keep
it about the present, not a changelog.

## Where the project is

Public beta on free-tier infrastructure (user-facing copy in
`game-sessions.service.ts` says rooms are "capped … while Buzrr is in beta on
free-tier infrastructure"). Both flagship modes work end-to-end: classic
hosted rooms (join by code/link/QR, kick/ban, host-abandon cleanup) and 1v1
duels (ELO matchmaking, bot fallback, unrated friend invites). Supporting
features shipped: AI quiz generation, question moderation + roles, profile
stats/history, health endpoint, Vercel Analytics.

## Recent architectural moves (still fresh, know they exist)

- **Server-authoritative rewrite** (PR #17): engine + Redis live state +
  state-sync contract — the defining refactor; see ADR-002.
- **Moderation & roles** (PR #18), **beta room cap** `hostSizeLimit` (#25),
  **kick/ban** (#35), **friend invites** (#34), **health check** (#37),
  **duel bots** (#39 — current HEAD).
- **Legacy contract retired**: the v1 socket dual-emits/aliases, the
  `POST /:id/answers` fallback route and the vestigial
  `GameSession.gameState`/`currentQuestion` columns are gone. The socket
  contract now has exactly one version. See the ADR-002 amendment; migration
  `20260814000001` must be applied with `migrate:deploy` in production.

## In transition / incomplete (verified in code)

1. **vinext/Vite parallel toolchain** — present, non-default, end-state
   unknown (ADR-008).
2. **Duplicate client socket typings** — `apps/web/src/types/socket-events.ts`
   is a hand-kept mirror of the server contract; nothing enforces sync.

## Known debt & risks (grounded, ranked by blast radius)

1. **Zero automated tests.** CI = lint + typecheck + build
   (`.github/workflows/ci.yml`). The most intricate logic (engine phase
   machine, Lua-scripted races, ELO transactions) is exactly the kind that
   regresses silently. Any test infra would be new — there's no
   runner configured at all.
2. **Redis is a single point of failure** for all realtime + matchmaking;
   the server won't boot without it. No degraded mode.
3. **In-memory grace timers** (lobby removal 60s, duel forfeit 30s) die with
   their instance. Duel forfeits are re-derived from the roster's `lastSeenAt`
   by the sweeper (`sweepDuelForfeits`) and classic has the host-abandon sweep,
   so a crash delays those by up to a sweep tick rather than skipping them.
   **Lobby removal still has no backstop.**
4. **CORS defaults open**: unset `WEB_ORIGIN` reflects any origin; prod must
   set it (documented in `.env.example`).
5. **Player row growth**: guest identities are never deleted (by design,
   ADR-005) and there is no cleanup job.
6. **Gemini parsing is format-fragile**: `parseQuestions` expects an exact
   text layout from `gemini-2.5-flash`; model drift breaks AI quiz creation
   (fails safe with 400/502).
7. **7-day stateless JWTs**: sign-out/demotion doesn't invalidate minted
   tokens; role checks re-read the DB (mitigates authz), identity itself
   remains valid until expiry.
8. **Host-screen roster state is triplicated** (REST lobby snapshot,
   `playersSlice`, `game.players`) — coherent today but easy to desync when
   editing lobby UI.

## Active development areas (inferred from recent PR cadence)

Duel-mode depth (bots were last), host quality-of-life (kick/ban, room caps),
and UX polish. No public roadmap file exists in-repo beyond the marketing
`/roadmap` page.

## Operational facts worth knowing

- Local dev needs Docker; `yarn setup` is idempotent and self-healing.
- Prod DB changes go through committed migrations (`migrate:deploy` from
  `packages/prisma`); the repo's migrations are the schema history.
- The duel pool can be legitimately empty (moderation gate) — seed with
  `yarn workspace @buzrr/prisma seed:duel` if duels error with
  "No duel questions".
