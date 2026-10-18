# todo.md — 500 players with a sound skin

Findings from buzrrbench runs against quiz.woikn.de on 2026-10-18. Work the
items in this order. Every item ends with how to check it. Remove an item from
this file once it is done.

Bench command used (room code from the host screen):

```sh
python3 tools/buzrrbench/buzrrbench.py --url https://quiz.woikn.de --code <CODE> \
  --users 510 --procs 4 --timeout-after 10 --timeout-users 10
```

Two runs at 510 players, same build (0a520b1):

| Metric                             | VGH5AV (no skin music) | RPTZRU (skin with music) |
| ---------------------------------- | ---------------------- | ------------------------ |
| join HTTP 500                      | 0                      | 0                        |
| join p50 / p95                     | 0.21 s / 1.4 s         | 0.26 s / 1.6 s           |
| downloaded in total                | 189 MB                 | **1 950 MB** (aborted)   |
| download retries / failed for good | 873 / 23               | ~4 800 / ~1 500          |
| `submit-answer` ack p50 / p95      | 0.8 s / 4.4 s          | 2.0 s / 10.8 s           |
| `request-sync` RTT p50             | 1.8 s                  | 5.9 s                    |
| `question-start` spread            | 0.2 s (q4: 0.2 s)      | 29–38 s                  |
| unexpected socket disconnects      | 168                    | 1 790                    |
| reactions sent                     | 10 966                 | 15 901                   |

The RPTZRU run fell apart: bots ended up in different phases, answers came in
late, the host screen stalled. Cause: the skin's sound files, which every
device with sound fetches.

| Skin slot (RPTZRU) | size per device | devices | total  |
| ------------------ | --------------- | ------- | ------ |
| lobby              | 1.4 MB          | 481     | 669 MB |
| question           | 2.4 MB          | 127     | 307 MB |
| reveal             | 2.6 MB          | 136     | 352 MB |
| scores             | 0.7 MB          | 269     | 192 MB |
| final song (clip)  | 0.6 MB          | 476     | 291 MB |
| countdown          | 0.2 MB          | 476     | 100 MB |

- The question, reveal and scores beds start downloading on **every device
  at the same moment** (phase change). At the question start that is
  500 × 2.4 MB ≈ 1.2 GB at once.
- The socket traffic shares the same uplink, so game events arrive tens of
  seconds late.
- Part of the errors (`ClientConnectorDNSError`) is the bench machine's own
  line, but the burst is real for real phones too.

---

Done since: 1 (small player copies of skin files, full length — the host
keeps full quality), 3 (reaction budgets 30 / 10 / 5 / 2 by room size, per
player, afresh per question), 4 (`--react-share`), the cache headers of 6.
Dropped: 5 — players get the music whenever the quiz plays it on their
devices, whatever the room size (loaded in the lobby, cached).

## 2. All encrypted assets load in the lobby; the lobby bar shows it; start waits for it

The question clips and the final song are encrypted (the key only comes with
`question-start` / the reveal / `finalSoundKey`), so they can be downloaded
long before they play without giving anything away. Right now they are
loaded per question (`preloadEffects(state, index)` in
`apps/server/src/modules/game-engine/core/machine.ts`, one question ahead),
and the countdown then waits for slow devices (`waitForDownloads`).

New behaviour:

1. **Download everything in the lobby.** When a player joins the lobby (and
   on every reconnect in the lobby), the server sends a `preload` with the
   URLs of **all** encrypted assets of the quiz:
   - every question's clips (`preloadUrls` for each question),
   - the final song clip (`skin.finalClipUrl`),
   - plus the skin slots from item 1 (small now, not encrypted, but they are
     needed too).

   The questions are only known at start today (`event.questions` in the
   start transition). Load them (or just their clip URLs) when the lobby
   opens, so the lobby can hand them out. The device starts after a random
   delay of 0–3 s (as in `director.tsx` now), so a QR-code crowd doesn't
   start at once.

2. **Report progress.** The device reports `preload-status` per file as
   today (`loaded`, `total`, `done`, `failed`). The server keeps one state
   per player: assets done yes/no (done or failed after the retries both
   count as done, so nobody blocks forever).
3. **Lobby bar with two colours** (host lobby,
   `apps/web/src/components/Admin/Lobby.tsx`, the bar with `fillPct` around
   line 265 / 471):
   - Light colour: connected players / `maxPlayers` (what it shows now).
   - Strong colour on top: players whose assets are all downloaded /
     `maxPlayers`.
   - Text below, e.g. "412 / 480 bereit". New strings in `en` and `de`.
   - The server sends the host the ready count with the lobby updates (one
     number, bundled like the `bubble-stats` batch, at most once a second).
4. **Start only when everything is there.** The start button stays disabled
   while connected players are still downloading. Same rules as
   `waitForDownloads`:
   - Players who left or went quiet (no progress for `DOWNLOAD_STALL_MS`)
     don't count.
   - **At most 30 s** (`DOWNLOAD_MAX_WAIT_MS = 30_000`, already the limit of
     the countdown wait): 30 s after the last player joined (or after the
     host pressed start), the host can start anyway. Show the button as
     "Trotzdem starten (n laden noch)".
   - The server checks the same rule on `start-game`, not only the button.
5. **Later questions no longer preload.** Since everything is on the device,
   `preloadEffects` per question and the countdown's `waitForDownloads` are
   only needed for players who joined after the start (late joiners): send
   them the whole list once on join, and the countdown waits for them as
   today (max 30 s).
6. Update `docs/architecture/realtime.md` (preload section) and the bench
   (`tools/buzrrbench/buzrrbench.py`: handle the lobby `preload`, count
   "assets ready at start").

**Done when:**

- At 500 bots the downloads all happen in the lobby, and from the first
  question on there are no downloads besides late joiners.
- The host lobby shows both colours, and the start button only unlocks when
  all are ready or after 30 s.
- `question sound still loading when it opened` is 0 for players who were in
  the lobby.

## 6. A CDN for `/uploads` (infrastructure decision, open)

Cache headers are done (`immutable`; public avatar / built-in files a year).
Still open: put `/uploads` behind a CDN or a separate static host, so a
download burst can't slow down the game sockets. Needs a decision on the
hosting side.

---

After each item:

- Run `yarn check-types`, `yarn lint`, `yarn workspace server test` and
  `yarn workspace web test`.
- Update `docs/architecture/realtime.md` where it describes the changed
  behaviour.
- Commit with the bench numbers before and after.
