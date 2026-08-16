# Realtime architecture (game engine + gateway)

The heart of Buzrr. Read this before changing anything under
`apps/server/src/modules/game-engine/` or `modules/realtime/`, or any socket
code in the web app.

## Cast of components

| Component           | File                                                         | Responsibility                                                                                                                               |
| ------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `GameEngineService` | `apps/server/src/modules/game-engine/game-engine.service.ts` | The authoritative loop: phase transitions, timers, scoring, presence, forfeits, result persistence. ~1,250 lines; most invariants live here. |
| `GameStoreService`  | `.../game-engine/game-store.service.ts`                      | The only Redis access layer for live games (`game:{code}:*` keys, 6h TTL). Contains the atomic Lua scripts.                                  |
| `DuelBotService`    | `.../game-engine/duel-bot.service.ts`                        | In-process timer that fires the bot's pre-planned answer through the normal `submitAnswer` path.                                             |
| `RealtimeGateway`   | `apps/server/src/modules/realtime/realtime.gateway.ts`       | Socket.IO entry: validates connections, joins rooms, registers per-role handlers, relays intents to the engine. No game logic.               |
| `RealtimeService`   | `.../realtime/realtime.service.ts`                           | Connection validation: parses handshake, verifies JWT/cookie, checks the player/host belongs to the room.                                    |
| `realtime.types.ts` | `.../realtime/realtime.types.ts`                             | The typed socket contract (server side). Mirrored client-side in `apps/web/src/types/socket-events.ts` — **keep both in sync by hand**.      |
| `RedisIoAdapter`    | `apps/server/src/redis/redis-io.adapter.ts`                  | `@socket.io/redis-adapter` wiring so room broadcasts reach sockets on other instances.                                                       |

The gateway holds the `Server` instance and hands it to the engine,
matchmaking, and invite services in `afterInit` (`setServer(...)`).

## Phase machine

```text
lobby → starting → question ⇄ reveal → final → ended
        (3.2s)     (timeOut    (duel: 4s auto;
                   +300ms       classic: host-paced)
                   grace)
```

- Transitions are executed **only** by the engine: `enterQuestion`,
  `enterReveal`, `enterFinal`, `endGame`.
- Classic pacing: the host emits a single intent, `host-next`; the server
  decides what "next" means from the current phase (`hostNext()`).
- Duel pacing: deadlines drive everything; reveal auto-advances after
  `DUEL_REVEAL_MS = 4000`.
- A question closes early when every **connected** rostered player has
  answered (`maybeRevealEarly`).
- `enterFinal` in duel mode immediately calls `endGame`.

## Timing & timer ownership (multi-instance model)

Timers are in-process `setTimeout`s, but their source of truth is Redis:

- Every upcoming transition writes its timestamp into the global sorted set
  `games:deadlines` (`store.setDeadline`), then arms a local timer.
- When a timer fires, `handleDeadline` first calls `store.ensureOwner(code,
instanceId)` — a `SET NX PX 20000` owner lock with renew-if-held Lua — so
  **only one instance executes transitions for a game** even if several have
  timers armed.
- A 15s **sweeper** (`sweep()`) re-reads `games:deadlines` and fires any
  past-due transition whose local timer was lost (crash, other instance). It
  also ends classic games whose host has been disconnected >5min
  (`HOST_ABANDON_MS`), using `parkDeadline` entries so host-paced phases with
  no natural deadline stay visible to it.
- On boot, `recoverTimers()` re-arms everything in `games:deadlines` and
  re-arms a mid-flight bot answer from meta (`recoverBotAnswer`) — a process
  restart resumes live games.
- The sweeper and the matchmaking worker are **lazy**: they run only while
  deadlines/queue entries exist. This is a deliberate Upstash cost decision
  (comment in `ensureSweeper`: an unconditional 15s poll ≈ 350K Redis
  commands/month at zero users). Don't make them unconditional.

Grace timers (lobby disconnect 60s, duel forfeit 30s) are **in-memory only**
(`disconnectTimers`) — they do not survive a restart. The sweeper is the
backstop for the two that matter: the abandon check for classic, and
`sweepDuelForfeits` for duel forfeits (below). Lobby removal has none.

### Paused duels

A duel with **no connected human** is frozen instead of played out
(`pauseDuel`, triggered from `playerDisconnected`; bots are permanently
`connected` and never count — `hasConnectedHuman`). Otherwise a bot duel runs
itself to the end during the 30s forfeit grace, and a player who reconnects in
time returns to a game that already moved on.

- Pause: `pausedAt` is **claimed** with a Lua compare-and-set
  (`store.claimPause`) before presence is re-checked, then timers and the bot
  answer are cancelled and the deadline is **parked** so the game stays visible
  to the sweeper. Claim-then-recheck is what makes a reconnect racing the
  disconnect safe: whichever order the two commit in, exactly one side resumes.
- Resume (`resumeDuel`, from `playerConnected`): every stored timestamp
  (`qDeadline`, `qStartAt`, `botAnswerAt`) is shifted forward by the paused
  span, so the returning player keeps the time they had left and their score
  decays from the same point. Clearing `pausedAt` is itself a claim
  (`store.claimResume`, one Lua step with the shift) — only the winner re-arms,
  so two racing resumes can't move the deadlines twice. No broadcast — a paused
  duel has no other connected player, and the gateway's snapshot follows
  immediately.
- `handleDeadline` and `recoverBotAnswer` both no-op while `pausedAt` is set.

### Forfeit backstop

`DUEL_FORFEIT_MS` is enforced by an in-memory timer (`disconnectTimers` →
`resolveDuelForfeit`), which dies with its instance. `sweepDuelForfeits` re-derives
it from Redis each sweep: any rostered non-bot player who is `connected: false`
with `lastSeenAt` older than the grace is resolved through the same
`resolveDuelForfeit` (opponent still there = forfeit, both gone = abandoned).
This covers paused duels **and** duels still being played by a connected
opponent — the latter has no pause to key off, so without it a restart let the
quitter finish on score instead of forfeiting.

## Answer path (anti-cheat properties)

`submitAnswer(gameCode, playerId, qIndex, optionId)`:

1. Rejects unless phase is `question`, `qIndex` matches, and now ≤ deadline.
2. Rejects players not in the Redis roster (kicked players may still hold a
   live socket).
3. Time taken is **server-measured** (`now - meta.qStartAt`) — client clocks
   are never trusted, and no endpoint accepts a client-supplied elapsed time.
4. Score: `computeScore` (`common/utils/compute-score.ts`) — correct answers
   decay 1000 → 100 linearly over the question's `timeOut`; wrong = 0.
5. First write wins via `HSETNX` (`store.putAnswer`); duplicates rejected.
6. Score added to the Redis leaderboard zset; `maybeRevealEarly` runs.

Questions are sent to clients as `PublicQuestion` — **correctness stripped**
(`toPublicQuestion` in `game-engine.types.ts`). Never leak `isCorrect` before
reveal.

## Client synchronization contract

- The server pushes `state-sync` (full snapshot from `getSnapshot`) on every
  connect; clients also may emit `request-sync`. Reconnects therefore need
  **almost no client bookkeeping** — the whole screen re-renders from the
  snapshot (`apps/web/src/hooks/useGameSocket.ts` → `applySync` in
  `apps/web/src/state/game/gameSlice.ts`).
- The one exception is an **answer in flight when the socket dropped**: its ack
  never fires (socket.io discards pending acks on close) and the buffered emit
  is dropped server-side if it lands before the gateway registers handlers. So
  `Question.tsx` treats the snapshot's `you.answered` as the authority —
  re-sending the pick if the server never got it and the question is still
  open, unlocking the options if not. Anything less leaves a player locked on
  an answer that was never recorded, then shown "timed out".
- `enterReveal` emits each player's `answer-result` **before** the room's
  `question-end`. The other order flashes the timeout state: clients switch to
  the reveal screen with no personal result yet, and "no answer" is the only
  thing that screen can render.
- All countdowns render from server-issued `deadline` + `serverNow`; the
  client stores `clockOffset = serverNow - Date.now()` and never advances
  phases itself (`useServerCountdown.ts`).
- Per-player personal results go to the room `player:{playerId}`
  (`answer-result` events), which also works cross-instance via the Redis
  adapter.
- Event names: `question-start`, `question-end`, `answer-result`,
  `leaderboard`, `game-over`, `state-sync`, `player-connection`,
  `player-joined/removed/left`, `game-started`, `game-session-ended`, plus the
  `duel:*` family.
- The contract has **one version**. The old v1 events (`get-question-index`,
  `question-changed`, `displaying-result`, `displaying-final-leaderboard`,
  `timer-starts`) and the v1 host-intent aliases (`set-question-index`,
  `change-question`, `display-result`, `final-leaderboard`) were removed once
  the web client no longer used any of them — the server emits and accepts
  exactly what the current client speaks. Adding a compat alias "just in case"
  reintroduces the drift this removal cleared.

## Changing the socket contract — touch list

There is no codegen; a new/changed event means editing all of these by hand:

1. `apps/server/src/modules/realtime/realtime.types.ts` — payload +
   `ServerToClientEvents`/`ClientToServerEvents`.
2. Emitter: usually the engine (`emitRoom(...)` / `io.to("player:{id}")`), or
   the gateway/matchmaking/invites for `duel:*`.
3. Client→server events: handler registration in `realtime.gateway.ts`
   (`registerHostHandlers` / `registerPlayerHandlers` / duel branches). Use an
   **ack callback** for anything the client must confirm (pattern:
   `submit-answer`, `duel:invite-accept`).
4. `apps/web/src/types/socket-events.ts` — the hand-kept mirror.
5. `apps/web/src/hooks/useGameSocket.ts` — wire server events into Redux (or
   the `bind` callback for role-specific ones in
   `useAdminSocket`/`usePlayerSocket`).
6. `apps/web/src/state/game/gameSlice.ts` — reducer, if the event carries
   live-game state.

Also decide whether the event must appear in the `state-sync` snapshot
(`getSnapshot`) — if a reconnecting client needs the information, it does.

## Connection lifecycle (gateway)

`handleConnection` (`realtime.gateway.ts`):

1. Buffers early `duel:invite-accept` emits (they can beat validation, and
   socket.io drops events with no listener).
2. `RealtimeService.validateConnection` parses `userType`
   (`player|admin|duel`) + `gameCode` from the handshake query and
   authenticates (see [auth.md](auth.md)).
3. Classic connections: `socket.join(gameCode)`; players also join
   `player:{id}` **before** roster registration, then
   `engine.playerConnected` — which is atomic with the ban check
   (`upsertPlayerUnlessBanned` Lua). If banned → disconnect.
4. Hosts get host handlers (`start-game`, `host-next`, `end-game-session`,
   `remove-player`); players get `submit-answer` (with ack) and `leave-room`.
5. Snapshot is sent immediately.

Disconnect: hosts flip `hostConnected` meta; players get marked disconnected
and a grace timer starts (60s lobby removal, or 30s duel forfeit via
`resolveDuelForfeit`); duel-queue sockets are dequeued.

## Kick / ban semantics

- Kick = Redis roster+score removal, `player-removed` broadcast **before**
  `disconnectSockets(true)` on `player:{id}` (so the kicked client hears it),
  then `afterRosterShrink` (may trigger early reveal / leaderboard refresh).
- Ban = room-scoped Redis set `game:{code}:banned`, written **before** the
  kick so a reconnect racing the kick is refused; enforced atomically at
  roster registration and also checked in HTTP `join`. Bans die with the room
  (`deleteGame`), and the ban set's TTL rides the meta's renewal
  (`patchMeta`).
- Both flows exist twice: socket events and HTTP
  (`game-sessions.controller.ts` `DELETE :roomId/players/:playerId`, `POST
.../ban`) so a host with a dead socket can still moderate. Keep them
  behavior-identical.

## Game end & persistence

`endGame` is idempotent and race-safe: `store.claimEnded` (Lua) atomically
flips phase → `ended`; only the winner of that claim persists. Then:

1. `persistResult` writes the immutable `GameResult` + entries (correct counts
   are recomputed from Redis answer hashes). Rated duels apply ELO updates to
   `User` rows **in the same transaction** (including bot duels, where only
   the human has a row and the bot's rating comes from meta). Fallback: if
   quiz/host FK writes fail (deleted mid-game), it retries with nulls — a
   result is always attempted.
2. Broadcasts `game-over` (entries, `resultId`, `eloChanges`, `rated`) and
   `game-session-ended`.
3. Classic only: deletes the `GameSession` row and detaches players
   (`Player.gameId = null`) in a transaction.
4. `store.deleteGame` deletes every `game:{code}:*` key and the deadline
   entry.

Games that never left the lobby (`startedAt` 0 / `qCount` 0) produce **no**
`GameResult`.

## Things that will break subtly if you're careless

- Meta is a Redis hash of strings; `NUMERIC_META`/`BOOLEAN_META` sets in
  `game-store.service.ts` drive deserialization. **Adding a numeric/boolean
  meta field without updating those sets silently yields strings.**
- Every store write renews the 6h TTL on its own key; a game can therefore
  outlive 6h only if all keys keep being touched. The ban set is only renewed
  by `patchMeta` — preserve that coupling.
- `emitRoom` throws if the gateway hasn't called `setServer` yet — engine
  methods that can run at boot (sweeper/recovery) must tolerate `io` being
  used only through `emitRoom`'s guarded path.
- Bot answers are planned at `enterQuestion` and stored in meta
  (`botOptionId`, `botAnswerAt`) precisely so restarts can re-arm them. If you
  change bot planning, keep it restart-durable.
- `maybeRevealEarly` counts only **connected** players; bots are seeded
  `connected: true` (they have no socket) — see `startDuel` comment. Don't
  "fix" that.
