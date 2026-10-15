# Duels (1v1): matchmaking, invites, bots, ELO

All under `apps/server/src/modules/duel/` plus bot logic in
`common/utils/duel-bot.ts` and `modules/game-engine/duel-bot.service.ts`.
Duels run on the shared engine — read [realtime.md](realtime.md) first.

## What makes a duel different from a classic game

- **Redis-only**: no `GameSession` row. `engine.startDuel` seeds
  `game:{code}:*` directly with mode `duel`, both roster entries, and a
  snapshot of 7 questions. Entry to the socket room is gated by _already being
  in the Redis roster_ (`realtime.gateway.ts` duel branch), not by a DB row.
- **Requires a signed-in account** (`validateConnection`: JWT or Better Auth
  session cookie; guests can't duel).
- **Hostless auto-pacing** (4s reveals) and a 30s disconnect forfeit. The
  match freezes while nobody human is connected and resumes where it stopped —
  see [realtime.md § Paused duels](realtime.md#paused-duels).
- **Rated vs unrated**: matchmade duels are rated; friend invites pass
  `rated: false` so two accounts can't farm ELO (`duel-invite.service.ts` →
  `startDuel(..., { rated: false })`).

## Question pool

`DuelQuestionsService.build(categoryId?)` (`duel-questions.service.ts`) draws
`DUEL_QUESTION_COUNT = 7` random questions that are **standalone (no quiz) or
in an `isPublic` quiz**, **and** `question.moderationStatus = 'approved'`,
**and** (for a category duel) tagged with that category, **and** the question is
duel-eligible — `multiple_choice` or `true_false` with exactly one correct
option (raw SQL `ORDER BY random()`, then a findMany re-ordered to the raw
shuffle). Each row must pass its question type's own checks
(`toLiveQuestion`); the rest are skipped. Throws if fewer than
3 usable — matchmaking and invites both
surface that as "no questions". The moderation gate is what feeds this pool —
see [backend.md](backend.md#moderation).
`packages/prisma/scripts/seed-duel-starter.mjs` seeds a system-owned "Duel
Starter Pack" so the pool is never empty (the self-host `migrate` container
runs it on every start; it is idempotent) and the starter categories, with
the pack tagged General Knowledge.

## Categories

A duel is **Random** (no category — the whole pool) or one **category**
([ADR-015](../adr/015-duel-categories-and-standalone-questions.md)).
`GET /api/duel/categories` lists only categories with ≥7 pool questions, with
play counts (`GameResult.categoryId`). Each category has its **own rating**
(`UserCategoryRating`, created lazily at 1200); Random uses `User.eloRating`.
Only admins tag questions, from the **Duel Portal**
(`/admin/duel-portal`: bulk upload by category, per-row and bulk retag,
category create/edit/delete); quiz authors can't. The category travels as: socket handshake `?category=` / `duel:queue
{ categoryId }` → the queue meta → `startDuel(..., { category })` →
`GameMeta.categoryId/categoryName` → `GameResult.categoryId` and the
`game-over` payload. `duel:matched` carries `category` + `questionCount` for
the countdown screen.

## Matchmaking (`matchmaking.service.ts`)

State (all Redis): `mm:duel:queue` (zset userId→rating in the searched
category), `mm:duel:meta` (hash userId→{name,image,joinedAt,category}),
`mm:duel:lock`. **Only players searching the same category pair**, and only
a reachable human in the same category blocks the bot fallback. Re-emitting
`duel:queue { categoryId: null }` mid-search switches to Random (the web
offers it after 10s) and restarts the wait.

- `enqueue` on socket connect (server enqueues proactively because the
  client's `duel:queue` emit can arrive before handlers are registered).
- A **2s worker tick runs only while the queue is non-empty** (lazy start/stop
  — Upstash cost, same pattern as the engine sweeper).
- Pairing: longest-waiting seeker first; acceptable ELO gap widens with wait —
  `eloBand = min(100 + 50*floor(wait/2s), 500)`; either side's band suffices
  (`eloEligible`). One match per tick.
- Claiming both players is guarded by `mm:duel:lock` (`SET NX PX 5000`) +
  `zrem` count check, with rollback if only one was removed — safe across
  instances.
- Queue timeout 60s → `duel:queue-timeout`.
- **Bot fallback**: a player alone ≥8s (`BOT_MATCH_MS`) gets a bot — unless
  `DUEL_BOTS=OFF`. `tryBotMatch` re-reads the queue first and only bots the
  player if no _reachable_ human exists (someone outside the band doesn't
  block it). Matched payloads for bot duels are shape-identical to human ones
  (deliberate: client cannot distinguish).

## Bots

`common/utils/duel-bot.ts`:

- `createBotOpponent(humanElo)` — id `bot_<nanoid>` (the `bot_` prefix
  guarantees no `User.id` collision, which is what keeps bots out of user ELO
  lookups), human-like Indian-skewed name pool, ELO = human ±75 (floor 100),
  tier by human ELO: easy <1100, medium <1400, else hard.
- `planBotAnswer(question, tier, random)` — accuracy/delay per tier (easy
  30%, medium 70%, hard 88% — `BOT_PROFILES`; delays as fractions of the time limit, min 800ms so it never answers inhumanly
  fast, and 500ms clear of the deadline). What a right or wrong answer _is_
  comes from the question type's `sampleAnswer`, so bots play every type the
  pool serves. A "miss" is a wrong answer rather than silence so the early
  close still fires once both have answered.
- The plan is written into game meta when the question opens (`botAnswer`
  JSON + `botAnswerAt`; restart-durable);
  `DuelBotService` just holds the one-per-game timer and submits through the
  normal validated `submitAnswer` path. Bot duels are **rated** (ELO applied
  to the human only), and `resolveDuelForfeit` / forfeit rules apply
  normally — the human dropping pauses the match rather than letting the bot
  play it out (realtime.md § Paused duels).

## Friend invites (`duel-invite.service.ts`)

A pending invite is a **pre-game reservation of a code**, all in Redis:
`duel:invite:{code}` (hash) + `duel:invite:host:{userId}` (one pending invite
per host), TTL 15min. Codes come from `duel-code.ts`:

- Matchmade game codes: `D` + 5 chars (safe to be short — the code alone
  grants nothing; you must be in the Redis roster).
- Invite codes: `D` + 13 chars ≈ 64 bits — **the invite code is a bearer
  token** (whoever holds it can claim the duel); enumeration must stay
  infeasible. Validated by `DUEL_INVITE_CODE_PATTERN` in the controller DTO.

Lifecycle (all transitions are Lua scripts — keep them atomic):

- `create` — `CREATE_SCRIPT` also checks `game:{code}:meta` doesn't exist,
  because `initMeta` is HSETNX-guarded and a collision would silently reuse an
  old game's questions. Retries 5 codes; a host race returns the winner's
  code.
- `accept` (guest, via socket `duel:invite-accept` with ack) — order matters:

  1. guest busy-check
  2. record read
  3. **host presence check** — a live socket in `player:{hostId}` whose
     `socket.data.duelInviteCode` matches. Presence is derived from the socket
     adapter, never a stored flag, so a SIGKILL'd instance can't leave a stale
     "online".
  4. build questions
  5. `CLAIM_SCRIPT` (HSETNX `claimedBy`; claimed invites linger 60s so a losing
     racer reads "claimed" not "expired")
  6. re-read both users from Postgres (invite snapshot can be 15min stale)
  7. `startDuel(code, ..., { rated: false })`
  8. `duel:matched` to both `player:{id}` rooms

  If `startDuel` throws, `RELEASE_SCRIPT` un-claims so the guest can retry.

- `cancel` — host-only, refused once claimed.
- Both parties sit on an `intent=invite` socket (`useDuelInvite.ts`); that
  connection **is** the host-presence signal and is what guarantees the guest
  is listening before `duel:matched` fires. Invite sockets deliberately skip
  the engine/roster/snapshot path and their disconnect is a no-op (the invite
  outlives reloads).

REST surface (`duel.controller.ts`): `GET /api/duel/me`, `POST
/api/duel/invites`, `GET|DELETE /api/duel/invites/:code`, `GET
/api/duel/recent`.

## ELO (`common/utils/elo.ts` + `persistResult` in the engine)

- Start 1200 (`User.eloRating` default), floor 100 (`applyFloor`).
- K-factor 40 for the first 10 duels (`PROVISIONAL_GAMES`), then 24.
- Outcome: forfeiter loses outright; otherwise total score decides; equal
  scores = draw (0.5).
- Applied only when: mode `duel`, `rated !== false`, exactly 2 entries, not
  abandoned (both gone). `applyDuelRatings` updates the rating being played —
  `UserCategoryRating` for a category duel, `User.eloRating`/`duelsPlayed`
  for Random — and writes `eloBefore/After` plus each entry's `outcome` into
  `GameResultEntry` **in one transaction** with the `GameResult` insert. `eloChanges` ride the `game-over` payload so the client
  shows before→after without another fetch.
- `rated !== false` (not truthiness) is deliberate: duels created before the
  `rated` field existed have no flag in Redis and must stay rated across a
  deploy.

## Daily streak

One finished duel a day keeps a streak (`common/utils/daily-streak.ts`, pure
and unit-tested). A "day" is a calendar date in the user's IANA
`User.timeZone` (the web `PUT /api/duel/me/timezone`s the browser zone when
it differs; unset = UTC).

- `applyDailyStreaks` runs in the same `persistResult` transaction for
  **every** non-abandoned duel — rated, unrated invites and bot duels — for
  each signed-in duellist who didn't forfeit. Same day → no change;
  `lastStreakDay` = yesterday → +1; otherwise → 1. It inserts a `DuelDay` row
  (the calendar) and the result rides `game-over.streaks`.
- The stored `currentStreak` is never decayed in place: readers use
  `effectiveStreak` (0 once `lastStreakDay` is older than yesterday).
- REST: `GET /api/duel/me` (`streak`, plus Random and per-category records
  with W/L/D from `GameResultEntry.outcome`), `GET /api/duel/streak?month=`
  (calendar days).

## Client-side flow (web)

- `/duel` (`DuelClient.tsx`) — category picker (`CategoryPicker`, selection
  in `?category=`; `?auto=1` starts searching — "Play Again"), per-category
  `DuelProfileCard`, `StreakButton` calendar in the header, queue UI.
  `useDuelQueue` opens a `userType=duel` socket with no gameCode (and
  `?category=`), emits `duel:queue`, navigates to `/duel/game/{code}` on
  `duel:matched` (payload cached in sessionStorage via `matchedStorage.ts` for
  the countdown screen).
- `/duel/invite/[code]` (`DuelInviteClient` + host/guest views) — polls `GET
invites/:code` every 3s (`useDuelInviteQuery`) for status/host-presence, and
  holds the `intent=invite` socket (`useDuelInvite`) for accept + `duel:matched`.
- `/duel/game/[gameCode]` (`DuelGameClient.tsx`) — standard `useGameSocket`
  with `userType=duel`; renders from the `game` Redux slice; the result
  screen shows the category rating before→after and the daily streak from
  `game-over`.
- All `/duel/*` pages are session-gated per page via `requireDuelSession`
  (`lib/duel-session.ts`) to preserve deep-link callbacks.
