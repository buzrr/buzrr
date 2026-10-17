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
