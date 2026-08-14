# Architectural invariants

Rules an agent must understand **before** modifying Buzrr. Each is labeled:

- **[explicit]** — stated in code comments/docs and enforced by implementation
- **[implied]** — consistently implemented, though never stated in one place
- **[inference]** — our reading of intent; verify before relying on it

Violating one of these is an architectural change: do it deliberately, update
the docs, and write an ADR.

## Authority & source of truth

1. **[explicit] The server owns the game loop.** Timing, phase transitions,
   question advancement and scoring happen only in `GameEngineService`
   (comment at the top of `game-engine.service.ts`). The gateway relays
   intent; clients render pushed state. The host's only pacing intent is
   `host-next` — the server derives what "next" means from the current phase,
   so no client ever supplies a question index. Client countdowns are
   display-only (`useServerCountdown.ts`).
2. **[explicit] Answer timing is server-measured.** `submitAnswer` computes
   `timeTakenMs` from `meta.qStartAt`. Never trust a client clock for
   scoring, and never accept a client-supplied elapsed time.
3. **[explicit] Live state in Redis; Postgres = lobby record + final result.**
   (`game-store.service.ts` header comment; migration
   `20260712000003_drop_unused_tables`.) Do not add per-answer or mid-game
   writes to Postgres.
4. **[explicit] `GameResult`+entries are immutable** (schema comment). Entries
   snapshot names/pics because `Player` rows are ephemeral. Append-only.
5. **[implied] All live-game Redis access goes through `GameStoreService`.**
   Matchmaking/invites own their separate keyspaces (`mm:duel:*`,
   `duel:invite:*`); nothing else touches `game:{code}:*` directly.

## Correctness under concurrency & multiple instances

6. **[explicit] Everything must be safe with N server instances.** Broadcasts
   go through the Redis socket.io adapter; per-game transitions require the
   `game:{code}:owner` lock (`ensureOwner`); matchmaking pairs under
   `mm:duel:lock`; invite transitions are Lua-atomic. New timers, broadcasts
   or queue consumers must follow one of these patterns.
7. **[explicit] Game end is single-claimant.** `claimEnded` atomically flips
   phase→`ended`; only the winner persists and cleans up. Any new
   end-of-game side effect belongs inside/behind that claim.
8. **[explicit] First answer wins.** `HSETNX` per (game, question, player) —
   duplicates must never re-score.
9. **[explicit] Ban beats connect.** The ban set is written before the kick;
   roster registration is atomic with the ban check
   (`REGISTER_PLAYER_SCRIPT`); the HTTP ban writes Redis **before** detaching
   the Postgres membership (`banPlayerFromRoom` comment). Preserve these
   orderings when touching kick/ban/join.
10. **[explicit] Recovery is a first-class path.** Deadlines live in
    `games:deadlines`; boot runs `recoverTimers()`; the sweeper re-fires lost
    deadlines; bot answers are re-armed from meta. Anything time-driven you
    add must either live in that schedule or be explicitly documented as
    lost-on-restart (like disconnect grace timers).
11. **[explicit] Idempotency is the default.** HSETNX meta init, deleteMany
    cleanups, duplicate-report no-op, invite create/claim scripts. Assume any
    handler can run twice.

## Auth boundaries

12. **[explicit] One shared secret, two token types.** Web signs account JWTs
    and the server signs player JWTs with the same `BETTER_AUTH_SECRET`; only
    the `typ: "player"` claim separates them. Every verifier must respect
    `typ` (`jwt.strategy.ts`, `realtime.service.ts`,
    `current-user.decorator.ts`). Never accept a player token where an
    account is required (or vice versa).
13. **[explicit] Roles come from the DB at request time, never from the JWT**
    (`roles.guard.ts` comment — 7-day tokens vs immediate demotion). Web
    layouts re-fetch the role per request too.
14. **[explicit] Superadmin is not grantable via the API**
    (`UpdateUserRoleDto` restricts to `admin|user`; service refuses to touch
    superadmins or yourself).
15. **[implied] Better Auth's tables belong to the web app.** The server only
    reads `Session` for socket cookie fallback; all writes go through Better
    Auth in `apps/web`.
16. **[explicit] Duel invite codes are bearer tokens** — 13 chars ≈ 64 bits
    for that reason; game codes may stay short only because the socket gate
    also requires roster membership (`duel-code.ts` comments). Don't shorten
    invite codes or add invite-code-only privileges elsewhere.
17. **[implied] Web-side gates are UX; API guards are the enforcement.** Any
    new privileged behavior needs the server-side guard, not just a layout
    redirect.

## Game-domain rules

18. **[explicit] Correct answers are never sent to clients before reveal** —
    `toPublicQuestion` strips `isCorrect`; snapshots only include reveal data
    in the `reveal` phase.
19. **[explicit] Friend-invite duels are unrated** (`rated: false`) so
    ratings can't be farmed; matchmade (including bot) duels are rated. The
    check is `rated !== false` for pre-field compatibility
    (`persistResult` comment).
20. **[explicit] The duel pool only serves `isPublic` quizzes with `approved`
    questions** (`duel-questions.service.ts`), and **any edit re-enters
    moderation** (`questions.service.ts` comment). Don't create bypasses.
21. **[explicit] Bots must be indistinguishable and validated.** Bot answers
    go through the normal `submitAnswer` path; `duel:matched` payloads are
    shape-identical to human matches; `bot_` id prefix keeps them out of User
    lookups. Bots join `connected: true` because they hold no socket —
    required by `maybeRevealEarly`.
22. **[explicit] Kicked/banned guests keep their Player identity** — only room
    membership is dropped (service comments; `usePlayerSocket` mirrors this).
    Don't delete Player rows on kick.
23. **[explicit] Room size is capped by the host's `hostSizeLimit`** under a
    serializable transaction; rejoins bypass the cap. (Beta/free-tier
    protection — schema comment.)
24. **[implied] The 6h Redis TTL bounds a game's life** and acts as GC for
    abandoned rooms; every store write renews it; the ban set rides the
    meta's renewal. Don't remove renewals or extend TTLs casually.

## Contracts & compatibility

25. **[implied] The socket contract is duplicated on purpose** —
    `apps/server/src/modules/realtime/realtime.types.ts` ⇄
    `apps/web/src/types/socket-events.ts`. Every event change updates both
    (there is no codegen).
26. **[explicit] The socket contract has exactly one version.** The v1 events
    and host-intent aliases, and the legacy `POST /:id/answers` route, were
    removed once nothing consumed them (ADR-002). Both apps ship together,
    so don't reintroduce compat shims or a second event spelling for an old
    client — migrate both sides in the same change instead.
27. **[explicit] Background workers are lazy to protect the Upstash command
    budget** (engine sweeper comment quantifies it; matchmaking mirrors it).
    Don't add unconditional polling loops against Redis.
28. **[implied] The web app talks to the domain only through the Nest API**
    (React Query modules). Direct Prisma from web is limited to the three
    `server-only` auth/role/stats modules — don't widen that exception.
29. **[explicit] DB changes ship as schema + committed migration**
    (CONTRIBUTING.md); local dev may `db push`, production runs
    `migrate deploy`.
