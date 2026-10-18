# Realtime architecture (game engine + gateway)

The heart of Buzrr. Read this before changing anything under
`apps/server/src/modules/game-engine/` or `modules/realtime/`, or any socket
code in the web app.

## Cast of components

| Component           | File                                                         | Responsibility                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine core         | `apps/server/src/modules/game-engine/core/`                  | **Pure** rules of the game: the phase machine `step(state, event, now) → { state, effects }` (`machine.ts`), answer judging (`answers.ts`), snapshot/leaderboard projection (`views.ts`), pause/forfeit/abandon decisions (`lifecycle.ts`), pacing strategies (`pacing.ts`). No I/O; unit-tested in `core/__tests__`. |
| `GameEngineService` | `apps/server/src/modules/game-engine/game-engine.service.ts` | The shell around the core: loads state from Redis, runs the core's effects in order, and owns everything needing I/O or atomicity — first-write answers, the end claim, pause/resume claims, timers, recovery, result persistence.                                                                                    |
| Question types      | `apps/server/src/modules/question-types/`                    | One pure handler per type (check config, check + score an answer, strip the answer key, summarise the reveal, sample bot answers). The engine calls only `registry.ts`. See ADR-011.                                                                                                                                  |
| `GameStoreService`  | `.../game-engine/game-store.service.ts`                      | The only Redis access layer for live games (`game:{code}:*` keys, 6h TTL). Contains the atomic Lua scripts.                                                                                                                                                                                                           |
| `DuelBotService`    | `.../game-engine/duel-bot.service.ts`                        | In-process timer that fires the bot's pre-planned answer through the normal `submitAnswer` path.                                                                                                                                                                                                                      |
| `RealtimeGateway`   | `apps/server/src/modules/realtime/realtime.gateway.ts`       | Socket.IO entry: validates connections, joins rooms, registers per-role handlers, relays intents to the engine. No game logic.                                                                                                                                                                                        |
| `RealtimeService`   | `.../realtime/realtime.service.ts`                           | Connection validation: parses handshake, verifies JWT/cookie, checks the player/host belongs to the room.                                                                                                                                                                                                             |
| `@buzrr/contract`   | `packages/contract/src/socket.ts`, `question-types.ts`       | The socket contract — zod schemas + inferred types, imported by both apps (ADR-013). `realtime.types.ts` re-exports it and adds server socket plumbing (`SocketData`, `TypedServer`).                                                                                                                                 |
| `RedisIoAdapter`    | `apps/server/src/redis/redis-io.adapter.ts`                  | `@socket.io/redis-adapter` wiring so room broadcasts reach sockets on other instances.                                                                                                                                                                                                                                |

The gateway holds the `Server` instance and hands it to the engine,
matchmaking, and invite services in `afterInit` (`setServer(...)`).

## Phase machine

```text
lobby → starting → question ⇄ reveal → final → ended
        (5s)       (timeOut    (duel: 4s auto;
                   +300ms       classic: host-paced)
                   answer grace)
```

- Transitions are decided **only** by the pure core, `step()` in
  `core/machine.ts`, from events the shell feeds it: `start`, `host-next`,
  `deadline`, `answer-recorded`, `close-question`, `roster-changed`. It
  returns the next state plus an ordered list of **effects** (`patch-meta`,
  `set-deadline`, `park-deadline`, `arm-timer`, `emit`, `arm-bot`, `end-game`,
  `dispatch`, …) that `GameEngineService.run` executes strictly in order —
  the orderings below (window before broadcast, personal results before the
  reveal) are encoded as effect order and asserted in `machine.spec.ts`.
  `endGame` (the claim + persistence) stays in the shell.
- Each event loads only the state parts it needs (`PARTS_FOR`, via
  `store.loadState`: one pipelined round trip after the meta when the current
  question's answers are needed, otherwise one round trip with the meta in
  it). The per-answer `answer-recorded` event is stepped on the state
  `submitAnswer` already read, with the answered ids carried in the event; the
  early close is a follow-up `close-question` event (a `dispatch` effect)
  with a full load.

### Pacing

How a game moves past a reveal is a **strategy** (`core/pacing.ts`), stored
in meta as `pacing` (games from before the field fall back by mode):

| Strategy             | Used by | `host-next`        | Reveal ends               | Final leaderboard |
| -------------------- | ------- | ------------------ | ------------------------- | ----------------- |
| `hostPaced` (host)   | classic | advances the phase | never by itself (parked)  | waits for host    |
| `autoAdvance` (auto) | duel    | ignored            | after `AUTO_REVEAL_MS` 4s | ends the game     |

- The host emits a single intent, `host-next`; the machine decides what
  "next" means from the phase (question → reveal → next question/final →
  end).
- Shared by every strategy: the server-timed answer window, and the early
  close once every **connected** rostered player has answered.
- A host-paced reveal whose parked deadline comes due is re-parked, not
  advanced.
- Self-paced play (each player on their own clock) is planned; the strategy
  is where its advance rules belong, but it also needs per-player question
  state that `GameState` doesn't model yet (ADR-012).

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
- A restarted instance can't fire a game's deadlines until the dead
  instance's 20s owner lock lapses, so recovery after a crash takes up to
  ~20s plus a sweep tick (observed ≈29s in an end-to-end restart test).
- On boot, `recoverTimers()` re-arms everything in `games:deadlines` and
  re-arms a mid-flight bot answer from meta (`recoverBotAnswer`) — a process
  restart resumes live games.
- The sweeper and the matchmaking worker are **lazy**: they run only while
  deadlines/queue entries exist. This is a deliberate Upstash cost decision
  (comment in `ensureSweeper`: an unconditional 15s poll ≈ 350K Redis
  commands/month at zero users). Don't make them unconditional.

Grace timers (lobby disconnect 35s after the last heartbeat, duel forfeit 30s)
are **in-memory only**
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

`submitAnswer(gameCode, playerId, qIndex, answer)`:

1. Rejects unless phase is `question`, `qIndex` matches, and the window is
   stamped (`qStartAt` non-zero).
2. Rejects players not in the Redis roster (kicked players may still hold a
   live socket).
3. Timing (`resolveAnswerTiming`, `common/utils/answer-timing.ts`) uses server
   clocks only, and no input the client influences. The receive time is taken
   on entry; accepted if receive ≤ `qDeadline + ANSWER_GRACE_MS` (300ms), and
   `timeTakenMs = min(receive, qDeadline) - qStartAt` — the grace is a flat
   allowance every player gets for the trip on the wire, and answers that use
   it score as if they landed exactly on the deadline, so it buys arrival time
   and never points. There is deliberately **no per-socket RTT credit**: any
   such measurement is the client's own ack speed, which it can stall to buy
   both time and score. No endpoint accepts a client-supplied time.
4. The question's **type** judges it: `checkAnswer` validates the answer
   against the question (a malformed answer or unknown option is rejected
   as `Invalid answer`) and `score` prices it — for multiple choice,
   `computeScore` (`common/utils/compute-score.ts`): correct answers decay
   1000 → 100 linearly over the question's `timeOut`; wrong = 0. Steps 1–4
   are the pure `judgeAnswer` (`core/answers.ts`); the gateway first checks
   the payload shape against the contract's `submitAnswerSchema`.
5. First write wins: `store.recordAnswer` is one Lua script that does the
   `HSETNX`, adds the score to the leaderboard zset only if the answer was
   stored, and returns every answered id (`HKEYS`); duplicates are rejected.
6. The shell steps `answer-recorded` (with those ids) on the state it read
   for judging, whose step first broadcasts `answer-count` (`{ index, answered }`, total answers so
   far) — the host's "answers in" meter; question-phase `state-sync` carries
   the same number as `answeredCount` for reconnects — then, if every
   connected player has answered, closes the question early.
   **Exception — multiple submissions.** Word cloud and open text with
   `config.multipleSubmissions` (`handler.acceptsMoreAnswers`) take further
   answers: when `recordAnswer` reports a duplicate, the shell reads the
   stored answer, folds the new one in with the type's `mergeAnswers`
   (capped at `MAX_SUBMISSIONS` = 10 per player) and writes it back with a
   compare-and-set Lua script (`replaceAnswer`, retried on a lost race).
   Timing, score (0) and the answer count are unchanged, and such a
   question **never closes early** — it runs to its deadline or the host's
   Next (`onAnswerRecorded`, which is why `answer-recorded` and
   `roster-changed` load `questions`). The `submit-answer` ack carries the
   stored answer so the client shows everything sent so far.
7. **Unscored types only** (poll, word cloud, rating, open text): the shell
   schedules a `live-summary` — a per-game, per-instance trailing timer
   (`LIVE_SUMMARY_MS` = 1s) that reads the open question's answers and
   roster, runs the type's `summarize`, and emits `{ index, answered,
summary }` to `host:{gameCode}` only. A host's `state-sync` is followed by
   one immediately. It is best effort (several instances may each send one;
   the client keeps the highest `answered`) and never runs for scored types:
   the host screen is projected, so it would leak the answer.

**Cost per answer** (the hot path, once per player per question): one
pipelined read (`HGETALL` meta, `GET` questions, `HGETALL` players), one
`EVAL`, and one `PUBLISH` for `answer-count` — 5 commands, measured on a real
Redis by `game-engine/__tests__/answer-cost.spec.ts`. It was 10 + 1 `PUBLISH`
(and 4 `MULTI`/`EXEC`) before the read was shared and the writes merged. If
you add a Redis call here, update that spec's expected list on purpose. The
live summary (step 7) stays off this path: one read per second per game,
however many answers arrive.

**Window stamping.** Opening a question (`openQuestion` in the core) writes the `games:deadlines` entry, then
opens the phase in one meta write carrying `qStartAt = now`,
`qDeadline = now + timeOut` (the real window, no grace) and the bot plan, and
only **then** emits `question-start` with whatever is left of the window as
`remainingMs`. The order matters: `submitAnswer` reads the window back from
Redis, so a player answering the instant the event lands would race an
after-the-fact write and be rejected as "not started". The cost is the Redis
write, which comes out of the window rather than being billed to the player on
top of it. The reveal timer fires at `qDeadline + ANSWER_GRACE_MS`.

Questions are sent to clients as `PublicQuestion` — **the answer key
stripped** by the question type's handler (`toPublicQuestion` in
`question-types/registry.ts`). Never leak correctness before the reveal —
including the player's own: a question-phase `state-sync` tells a player
_that_ (and what) they answered, but `you.isCorrect`/`score`/`rank` stay
masked until the reveal (`buildSnapshot`).

## Client synchronization contract

- The server pushes `state-sync` (full snapshot from `getSnapshot`) on every
  connect; clients also may emit `request-sync`. Reconnects therefore need
  **almost no client bookkeeping** — the whole screen re-renders from the
  snapshot (`apps/web/src/hooks/useGameSocket.ts` → `applySync` in
  `apps/web/src/state/game/gameSlice.ts`).
- **A snapshot can be older than events already received.** It is read from
  Redis and sent once the read finishes, so a phase change in between (for
  example the host's next `question-start`) reaches the client first.
  `applySync` drops any snapshot that is behind the client's current point in
  the game (`gameProgress`; phases only move forward within a game). Without
  that check, a stale reveal snapshot left players on the result screen after
  the game had moved on. A new socket resets the slice to `idle`, so the
  first snapshot on a reconnect is always applied.
- A page coming back to the foreground emits `request-sync`
  (`resyncOnReturn`). A suspended mobile tab can still look connected after
  the server dropped it, and would otherwise miss every event until the
  client noticed the connection was dead.
- The one exception is an **answer in flight when the socket dropped**: its ack
  never fires (socket.io discards pending acks on close) and the buffered emit
  is dropped server-side if it lands before the gateway registers handlers. So
  `Question.tsx` treats the snapshot's `you.answered` as the authority —
  re-sending the pick if the server never got it and the question is still
  open, unlocking the options if not. Anything less leaves a player locked on
  an answer that was never recorded, then shown "timed out".
- The reveal emits each player's `answer-result` **before** the room's
  `question-end`. The other order flashes the timeout state: clients switch to
  the reveal screen with no personal result yet, and "no answer" is the only
  thing that screen can render.
- Deadlines go out as durations: `question-start` and question-phase
  `state-sync` carry `remainingMs`. The client converts it to a local-clock
  `deadline` on receipt (`gameSlice.ts`), so no cross-machine clock comparison
  happens, and never advances phases itself (`useServerCountdown.ts`).
- Per-player personal results go to the room `player:{playerId}`
  (`answer-result` events), which also works cross-instance via the Redis
  adapter.
- `question-end` (and reveal-phase `state-sync.reveal`) carries `summary` —
  whatever the question's type reveals (multiple choice: `counts` aligned
  with the options + `correctOptionIds`) — and `avgTimeMs`, the mean answer
  time of everyone who answered (`null` if nobody did). A reveal-phase
  snapshot also includes the public `question`, so a client reconnecting
  mid-reveal can render it.
  Reveal-time `leaderboard` entries (the reveal broadcast, a roster change
  during the reveal, and reveal-phase `state-sync`) carry `delta` — points earned on that question;
  final/ended leaderboards omit it.
  A room-wide `leaderboard` with more than `PLAYER_LEADERBOARD_TOP` (10)
  entries is split in `GameEngineService.send`: the host room gets all of it,
  the rest of the room (`.except(host:{code})`) the top 10 plus `total`.
  Sending the whole board to everyone grows with the room twice over
  (entries × recipients); at 109 players it delayed the `phase-change` behind
  it by about 300ms. A player's own standing comes with `answer-result`, and a
  player's `state-sync` carries the top plus their own row and
  `leaderboardTotal`.
- Event names: `question-start`, `question-end`, `answer-result`,
  `answer-count`, `live-summary` (host room only), `leaderboard`, `game-over`,
  `state-sync`, `player-connection`,
  `player-joined/removed/left`, `game-started`, `game-session-ended`, plus the
  `duel:*` family.
- `game-started` carries `remainingMs` until question 1 opens (the server's
  `START_COUNTDOWN_MS`, minus send latency); a `starting`-phase `state-sync`
  carries it too, so a mid-countdown (re)connect shows the real time left.
  Display only — the server opens the question on its own timer.
- The contract has **one version**. The old v1 events (`get-question-index`,
  `question-changed`, `displaying-result`, `displaying-final-leaderboard`,
  `timer-starts`) and the v1 host-intent aliases (`set-question-index`,
  `change-question`, `display-result`, `final-leaderboard`) were removed once
  the web client no longer used any of them — the server emits and accepts
  exactly what the current client speaks. Adding a compat alias "just in case"
  reintroduces the drift this removal cleared.

## Question sounds: preload and the countdown's wait

- During a reveal (or the get-ready slide) the room gets `preload` with the
  next question's encrypted clips. Each device starts after a random pause of
  up to 3 s (`PRELOAD_SPREAD_MS`, `lib/sound/preload.ts`) and reports
  `preload-status` with `loaded: 0` at once, so the countdown counts it as
  downloading.
- **Download slots** (`MAX_PARALLEL_AUDIO_DOWNLOADS`, `audio-slots.ts`): a
  device that has to download asks `preload-slot` first (ack `{ go, limited }`);
  queued devices get `preload-go { qIndex }` as slots free up — on a `done`
  report, a disconnect, or 8 s without progress (`SLOT_STALL_MS`). The host
  never queues. While queued the device reports `loaded: 0` every 1.5 s, so
  the countdown keeps counting it. In memory per server process; unlimited
  when unset (the ack says `limited: false` and devices spread their own start).
- Slots come in two kinds, each with its own limit: `question` (above) and
  `skin` — a user sound skin's files. A device with sound on fetches them
  once in the lobby (`fetchSkinFiles`: one slot, the files one after the
  other, `preload-slot` again every 4 s as a keepalive, then `slot-done`);
  the final song's encrypted clip and any file not yet here when its phase
  plays go through the same slot.
- A failed download is retried up to 5 times after a random, growing pause; a
  clip given up reports `done: true, failed: true` — the countdown never
  waits for it. Clips are mono, 64 kbit/s.
- The countdown (`waitForDownloads`) waits for connected devices still
  downloading, ignores ones whose progress stalled for 4 s, and gives up
  after 30 s. Its `phase-change` carries `waitingFor`, `downloadDevices` and
  `downloadsDone`; the host answers with `downloads-decision { wait }`: go on
  now, or wait without the 30 s limit (`preloadWaitAll`, then `waitAll: true`).
  Questions with "∞" time have no countdown and no wait.

## Sound skins: playback options

A user skin can have its own countdown and song for the last question
(`lastCountdown`, `lastQuestion`; empty: the usual countdown / question music
plays). Built-in skins always have them: a recording (the superadmin's), or
a stepped-up synth (higher countdown with a heartbeat and a bigger hit; the
question loop starting halfway up its build).

Built-in skins can have recordings (`builtin_sound_options.slots`, public
`builtin-*` uploads) with default options to reset to; a slot without one is
synthesized. "Clone to own" copies a built-in into a user skin (files copied). Each slot of a skin has options (`soundSlotOptionsSchema`, stored per user
skin in `sound_skins.options`, for the built-in skins in
`builtin_sound_options` — only the superadmin changes those):

- `volume` 0–100 (80 = the usual level), `fadeIn` + `fadeInSec` (the
  question music fades in over 2 s unless set otherwise).
- `repeat` (lobby, question, last question, scores, reveal, final): default off, on for
  the lobby. Built-in synth loops run until the phase ends unless repeat is
  set off (then 8 bars).
- Files only: `startMs`. Countdown / question: `align: "end"` plays the file
  so its `endMs` lands on the end of the countdown (5 s) or the question,
  starting later when there is less time left than song before that point;
  `extendSec` (0–5) keeps it playing after the phase ends, then it fades out.
  "∞" questions play from the start.

Lobby cues (`join`, `bubble`, `reaction`, host only): a built-in skin plays
its own variant (Show, Arcade's 8-bit, Chill's soft ones); a user skin picks
per cue — a built-in variant, off, or its own file (`source`; default: the
file if there is one, else Show's) — with a volume.

The tusch (`end`) plays on top of everything and is never stopped. Its zero
point (`endMs`; the synth skins' hit after their roll) lands on the question's
end: it is started that long before the deadline; if the question closes
early, it comes in right at the zero point.

The question music starts once the countdown is over: the countdown's song
stops when the question opens, an end-aligned one after its "plays on after
0" seconds, and the question music waits for that. Lobby, reveal and
scoreboard songs fade out over 1 s when their phase ends, and the next
sound waits for that too.

The options editor shows the uploaded file's waveform: click or drag sets
the start point (or, end-aligned, the end / zero point), with the part that
plays, the extend and the fade-in drawn on it.

Files play through Web Audio (`lib/sound/song.ts`: gain ramps work on iOS);
an `<audio>` element is the fallback. The audio skins page has a test bench
per skin: a round with countdown, question (chosen length), tusch and
optionally reveal and scoreboard, timed like a game.

## Lobby extras: bubbles and reactions

- **Bubble game:** players send `bubble-stats` (their running hits/misses,
  about once a second). The gateway keeps the latest totals per player in a
  per-room map and sends the host one `bubble-stats-batch` a second with the
  players that changed (`players: { [playerId]: { hits, misses } }`). A room
  quiet for 10 batches stops its timer. At 500 players that is one event a
  second into the host's browser instead of about 500.
- **Reactions:** relayed to `host:{code}` one by one, but each player may
  send `REACTIONS_PER_WINDOW` (5) per `REACTION_WINDOW_MS` (20 s); the
  player's buttons rest until the oldest tap leaves the window. Above
  `ROOM_REACTIONS_PER_S` (40) in a room within one second, only each
  player's first reaction of that second passes.
- **Host lobby:** applies reactions in batches (every 500 ms) and joins every
  250 ms; player cards are memoised, so an update re-renders only the cards
  it changed. Above 40 players no reorder animation and no count-up numbers,
  above 60 no bubbles rise out of the cards. The join ping plays at most
  every 150 ms (Arcade's reaction pling at most every 5 s).

## Changing the socket contract — touch list

The contract is defined once, in `@buzrr/contract`; both apps compile against
it, so a change shows you every place that must follow:

1. `packages/contract/src/socket.ts` — the zod schema for the payload and
   `ServerToClientEvents`/`ClientToServerEvents`. (Question-type shapes live
   in `question-types.ts`; adding a whole type is CONTRIBUTING.md § Adding a
   question type.)
2. Emitter: usually the core (`Outbound` in `core/state.ts` + the `send`
   switch in `GameEngineService`), or the gateway/matchmaking/invites for
   `duel:*`.
3. Client→server events: handler registration in `realtime.gateway.ts`
   (`registerHostHandlers` / `registerPlayerHandlers` / duel branches);
   validate the payload with the contract schema. Use an **ack callback** for
   anything the client must confirm (pattern: `submit-answer`,
   `duel:invite-accept`).
4. `apps/web/src/hooks/useGameSocket.ts` — wire server events into Redux (or
   the `bind` callback for role-specific ones in
   `useAdminSocket`/`usePlayerSocket`).
5. `apps/web/src/state/game/gameSlice.ts` — reducer, if the event carries
   live-game state.

Also decide whether the event must appear in the `state-sync` snapshot
(`buildSnapshot` in `core/views.ts`) — if a reconnecting client needs the
information, it does.

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

Disconnect: hosts flip `hostConnected` meta (`hostDisconnected`); players get
marked disconnected and a grace timer starts (lobby removal, or 30s duel
forfeit via `resolveDuelForfeit`); duel-queue sockets are dequeued. The lobby
removal comes `HEARTBEAT_TIMEOUT_MS` (35s) after the player's last heartbeat,
at least 10s after the disconnect (a page reload), or 35s after the disconnect
for clients that don't beat. It only takes them off the Redis roster and the
host's list: their Postgres row still points at the room, so a player who
comes back is simply admitted again.

**Heartbeat.** Player clients emit `heartbeat` on connect, on returning to the
foreground and every `HEARTBEAT_INTERVAL_MS` (10s, `@buzrr/contract`). The
gateway (`watchHeartbeat`) records it in `socket.data.lastBeatAt`; a socket
that has beaten once and then stays quiet for `HEARTBEAT_TIMEOUT_MS` (35s,
three missed beats) gets its transport closed. The transport's own ping can't
tell a frozen page from a live one. Closing the transport rather than the
socket makes a page that wakes up reconnect by itself, since a server-side
socket disconnect reads as "refused" and is never retried. Mid-game the player
then only shows as offline and keeps score and answers. Clients that never
beat (older pages) are left to the transport ping. The host's in-game counters
("x of y answered", responses) count online players only.

**Presence is per person, not per socket**, so a closing socket only marks its
owner gone if they have no other socket in the game. A client that reconnects
gets a new socket while the server still holds the old one until the ping
timeout (`pingInterval` + `pingTimeout`, 10s + 10s on the gateway). Before the
check, the old socket closing marked a player who was still connected as gone.
The early close then ended the next question as soon as everyone else had
answered, and a host could be marked gone and caught by the abandon sweep.
`playerDisconnected` / `hostDisconnected` look for a remaining socket with
`fetchSockets()` (cluster-wide via the Redis adapter) in `player:{id}` /
`host:{gameCode}`. They match on `socket.data` (this game, this player or the
host), because `player:{userId}` also holds a duel user's queue and invite
sockets. Each one checks, writes, then checks again, so a reconnect that lands
mid-write can't be overwritten. If the lookup fails, the person is treated as
gone (the previous behaviour). Covered by
`game-engine/__tests__/presence.spec.ts`.

## Kick / ban semantics

- Kick = Redis roster removal with the score taken off the leaderboard but
  parked in `game:{code}:departed` (`REMOVE_PLAYER_SCRIPT`). A player who
  rejoins later (not banned) gets it back in `REGISTER_PLAYER_SCRIPT`, and
  their answers never left. Same for a voluntary `leave-room` and the lobby
  removal. Then `player-removed` broadcast **before**
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
- Bot answers are planned when a question opens (via the question type's
  `sampleAnswer`) and stored in meta (`botAnswer` as JSON — older games:
  `botOptionId` — plus `botAnswerAt`) precisely so restarts can re-arm them.
  If you change bot planning, keep it restart-durable.
- The core never performs I/O and must stay deterministic: randomness comes
  in through `StepContext.random`, time through `now`. Effects run in the
  order returned — reordering effects reorders writes and broadcasts.
- The early close counts only **connected** players; bots are seeded
  `connected: true` (they have no socket) — see `startDuel` comment. Don't
  "fix" that.
