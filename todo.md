# todo.md — scaling a classic room to 500 players

Findings from buzrrbench runs against quiz.woikn.de on 2026-10-17 (110, 250
and 510 simulated players, one bench process on one machine). Work the items
in this order. Every item ends with how to check it. Remove an item from this
file once it is done.

Bench command used (room code from the host screen):

```sh
python3 tools/buzrrbench/buzrrbench.py --url https://quiz.woikn.de --code <CODE> \
  --users 510 --timeout-after 10 --timeout-users 10
```

Baseline at 510 players (418 got in):

| Metric                         | Value                                   |
| ------------------------------ | --------------------------------------- |
| join HTTP 500, retried         | 409                                     |
| joins failed after all retries | 82                                      |
| join latency                   | p50 4.1 s, p95 13 s                     |
| `request-sync` RTT             | p50 3.4 s                               |
| `submit-answer` ack            | p50 650 ms, p95 2.5 s, 9 timeouts       |
| `phase-change: scores` spread  | 1.5–2.1 s                               |
| `question-end` spread          | about 160 ms                            |
| sound downloads                | 806 files, 155 MB, 345 failed, p50 13 s |
| unexpected socket disconnects  | 52                                      |

At 100 players everything was fine: join p50 30 ms, answer ack p50 18 ms,
`request-sync` p50 16 ms, every spread under 80 ms.

---

## 1. Join returns HTTP 500 under a crowd (highest priority)

`POST /api/game-sessions/join` → `GameSessionsService.join`
(`apps/server/src/modules/game-sessions/game-sessions.service.ts`).

What it does now:

- A **Serializable** transaction counts every player of the room
  (`tx.player.count({ where: { gameId } })`) to enforce the room cap, then
  updates the player.
- It retries only on `isSerializationConflict` (P2034, "could not serialize",
  40001, deadlock), up to `JOIN_ATTEMPTS = 8`.
- The 500s still happen: 33 at 250 players, 409 at 510. So the error is
  either not caught by that check, or 8 attempts are not enough.

Steps:

1. **Read the server log first.** Find the error behind the 500s during a
   bench run (the API container's logs around the join burst, Nest
   `ExceptionsHandler`). Likely candidates:
   - Prisma P2024: timed out fetching a connection from the pool.
   - P2028: transaction timeout or "Transaction already closed".
   - A serialization error with a code or message the check misses.

   Write the exact error into the commit message.

2. **Fix the cause, not the symptom.** Take the room-cap check out of the
   Serializable transaction, so concurrent joins don't conflict with each
   other. Options, pick one:
   - **(preferred)** An atomic per-room counter in Redis (`INCR`, compared
     with the limit, `DECR` on failure, leave or kick), or a Lua script next
     to the roster.
   - A single conditional SQL statement that sets `gameId` only while the
     room's count is below the limit (`UPDATE … WHERE (SELECT count(*) …) <
$limit`), run with ReadCommitted plus `SELECT … FOR UPDATE` on the
     game-session row as a per-room lock.

   Keep these behaviours:
   - A re-join of the same room never hits the cap.
   - The cap follows the host's plan at join time (`maxPlayersFor`, now with
     the `MAX_PLAYERS*` env from e15d345 / e3eac2e).
   - A banned player gets 403.
   - The avatar-skin assignment stays as it is.

3. If the pool is the bottleneck, check the Prisma pool size
   (`connection_limit` / pg adapter `max`) against the joins arriving at
   once. A crowd scanning a QR code is a burst of several hundred.
4. Tests: add a unit test for the cap under concurrent joins (50 parallel
   joins into a room with a limit of 40 → exactly 40 succeed, the rest get 403,
   no 500). Put it next to the existing Postgres specs, which are opt-in.

**Done when:** a bench with `--users 510 --ramp 20` shows no
`http join-room: HTTP 500` (neither under Errors nor as "retried after"), and
join p95 is under 1 s.

## 2. Make buzrrbench realistic before trusting latencies at 500

`tools/buzrrbench/buzrrbench.py`. At 500 players the bench itself creates load
no real client creates, and one Python process may be its own bottleneck.

1. **Sync probe:** `sync_probe` sends `request-sync` from every bot every
   `SYNC_PROBE_EVERY = 5.0` s. Each answer is a full snapshot with the whole
   roster, which is 84 snapshots a second at 418 players. Real clients only
   sync on connect and on returning to the tab.
   - Probe from at most `--probe-bots` bots (default 20, picked at random),
     every 10 s.
   - Keep the metric name `request-sync rtt`.
2. **End of run:** one bot missed `game-over` and the bench waited forever.
   - Once 95 % of the connected bots have `done` set, wait 30 s more.
   - Then stop and print the summary.
   - Count the bots still not done as `bots without game end`.
3. **Several processes:** add `--procs N` (default 1).
   - Start N child processes with `--users / N` each.
   - Merge their metrics. Simplest: each child writes its raw latency lists
     and counters as JSON, and the parent prints one combined summary.
   - Broadcast spread needs comparable clocks: use `time.time()` in every
     child, which is fine on one machine.
4. Note in the README that runs above about 200 bots should use `--procs`,
   and that downloads share the bench machine's uplink.

**Done when:** a 510-bot run with `--procs 4` finishes on its own, and the
summary shows the same sections as before plus `bots without game end`.

## 3. One personal message per player per question (drop `my-standing`)

Every player needs their own points and place. `answer-result` already
carries them: `totalScore` and `rank` from `buildAnswerResult`
(`apps/server/src/modules/game-engine/core/views.ts`), sent once per player
per question. `my-standing` (22e41c5) sends the same again, one emit per
player below the top 10. That is about 408 extra Redis-adapter publishes,
sent **before** the room's `phase-change`.

Server:

- `apps/server/src/modules/game-engine/game-engine.service.ts`, `send()`,
  case `"leaderboard"`: remove the `for (const entry of
entries.slice(PLAYER_LEADERBOARD_TOP))` loop that emits `my-standing`.
  Keep the split: the host room gets the full board, everyone else
  (`.except(host:{code})`) gets `topOfLeaderboard(entries)` plus `total`.
- Make sure every path into a standings screen has sent `answer-result` for
  the last question, in
  `apps/server/src/modules/game-engine/core/machine.ts`:
  - `reveal()` sends it.
  - `showScores(state, true)` sends it when no reveal ran.
  - `enterFinal()` can be reached from `"closed"` via `hostNext` → `case
"closed"` → `advance()` when the answer and scores steps are off. Then no
    `answer-result` was sent for the last question. Check whether f879fb0
    ("moderated mode always reveals the answer") made that path unreachable.
    If it still exists, push `answer-result` per rostered player in
    `enterFinal` when `state.meta.phase === "closed"`, before the final
    `leaderboard`, the same way `showScores` does with `sendResults`.
  - Add a machine spec for it.
- `packages/contract/src/socket.ts`: remove `"my-standing"` from
  `ServerToClientEvents` and remove `MyStandingPayload` / its schema.

Web:

- `apps/web/src/hooks/useGameSocket.ts`: remove the `my-standing` listener.
- `apps/web/src/state/game/gameSlice.ts`: remove the `my-standing` state and
  the `myStanding` reducer.
- `apps/web/src/components/Game/ModeratedSteps.tsx` (`PlayerScores`) and
  `apps/web/src/components/Player/GamePage.tsx`: the player's own row comes
  from the board if they are in the top, otherwise from `state.game.you`.
  - Rank from `you.rank`, points from `you.totalScore`, points for this
    question from `you.score`.
  - Name and avatar from `state.game.players`.
  - Show it as an extra row below the top 10, with a gap when the rank
    doesn't follow on.
  - The player count comes from `leaderboardTotal ?? leaderboard.length`.
- Known, accepted limitation: if someone above leaves mid-round, a player's
  rank is one too low until the next `answer-result`.

**Done when:**

- With ≥ 250 bots, `phase-change: scores` spread is within about 2× of
  `question-end` spread for the same question.
- A player ranked 200 sees their own row with correct rank and points on the
  scores step and on the final screen.

## 4. Bundle lobby `bubble-stats` for the host

`apps/server/src/modules/realtime/realtime.gateway.ts`,
`socket.on("bubble-stats")`.

- Every player socket may relay one update per 800 ms to `host:{code}`. At
  418 players that is about 500 events a second into the host's browser
  (80 000 in one run).
- Collect the latest totals per player in a per-room map on the server and
  flush it to the host once a second as one event, e.g.
  `bubble-stats-batch: { players: { [playerId]: { hits, misses } } }`.
  Only players that changed since the last flush. Use one timer per room;
  stop it when the lobby ends.
- The host lobby (`apps/web/src/components/Admin/Lobby.tsx` and the
  `bubble-stats` handler) applies the batch.
- Keep the old single event for one release, or migrate both sides in the
  same change (see `realtime.md` § Changing the socket contract).

**Done when:** at 500 bots in the lobby the host receives about 1
bubble-stats event a second, and the lobby ranking still updates.

## 5. Spread the question-sound downloads

`apps/web/src/lib/sound/director.tsx`: `preloadClips(preload.urls,
preload.qIndex)` runs as soon as the `preload` hint arrives, on every device
at once. That was about 490 files (94 MB) at 250 players and 806 files
(155 MB) at 510, with timeouts and connection errors.

1. Start each device's preload after a random delay, at most 3 s or 25 % of
   the time left before the question, whichever is smaller. Report
   `preload-status` with `loaded: 0` right away, so the countdown's wait
   (`waitForDownloads`, `DOWNLOAD_STALL_MS`) doesn't treat the device as
   stalled.
2. Clip size: `CLIP_BITRATE = "96k"` in
   `apps/server/src/common/storage/audio-transcode.ts`.
   - Try `"64k"` (mono, music stays acceptable). That cuts download volume
     by a third.
   - Existing clips are re-encoded on next upload only. Decide whether a
     one-off re-encode is worth it.
3. Check the server's or proxy's limits for parallel connections and
   bandwidth to `/uploads`. The `ClientConnectorError` and
   `ConnectionTimeoutError` failures may come from there, or from the
   bench's single uplink (see item 2).

**Done when:** at 500 bots (with `--procs`), download failures are under 1 %
and `question sound still loading when it opened` is under 5 % of devices.

---

After each item:

- Run `yarn check-types`, `yarn lint`, `yarn workspace server test` and
  `yarn workspace web test`.
- Update `docs/architecture/realtime.md` where it describes the changed
  behaviour.
- Commit with the bench numbers before and after.
