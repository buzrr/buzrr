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

| Metric                              | VGH5AV (no skin music) | RPTZRU (skin with music) |
| ----------------------------------- | ---------------------- | ------------------------ |
| join HTTP 500                       | 0                      | 0                        |
| join p50 / p95                      | 0.21 s / 1.4 s         | 0.26 s / 1.6 s           |
| downloaded in total                 | 189 MB                 | **1 950 MB** (aborted)   |
| download retries / failed for good  | 873 / 23               | ~4 800 / ~1 500          |
| `submit-answer` ack p50 / p95       | 0.8 s / 4.4 s          | 2.0 s / 10.8 s           |
| `request-sync` RTT p50              | 1.8 s                  | 5.9 s                    |
| `question-start` spread             | 0.2 s (q4: 0.2 s)      | 29–38 s                  |
| unexpected socket disconnects       | 168                    | 1 790                    |
| reactions sent                      | 10 966                 | 15 901                   |

The RPTZRU run fell apart: bots ended up in different phases, answers came in
late, the host screen stalled. Cause: the skin's sound files, which every
device with sound fetches.

| Skin slot (RPTZRU)  | size per device | devices | total  |
| ------------------- | --------------- | ------- | ------ |
| lobby               | 1.4 MB          | 481     | 669 MB |
| question            | 2.4 MB          | 127     | 307 MB |
| reveal              | 2.6 MB          | 136     | 352 MB |
| scores              | 0.7 MB          | 269     | 192 MB |
| final song (clip)   | 0.6 MB          | 476     | 291 MB |
| countdown           | 0.2 MB          | 476     | 100 MB |

- The question, reveal and scores beds start downloading on **every device
  at the same moment** (phase change). At the question start that is
  500 × 2.4 MB ≈ 1.2 GB at once.
- The socket traffic shares the same uplink, so game events arrive tens of
  seconds late.
- Part of the errors (`ClientConnectorDNSError`) is the bench machine's own
  line, but the burst is real for real phones too.

---

## 1. Make skin sounds small

`apps/server/src/modules/sound-skins/sound-skins.service.ts` (around line
181): skin slots go through `toMp3` only (stereo, `-q:a 4` ≈ 165 kbit/s,
full length). Only the final song is cut (`cutClip(mp3, 0, FINAL_CLIP_MS)`).

- Encode every slot like the question clips: mono, `CLIP_BITRATE` (64k,
  `apps/server/src/common/storage/audio-transcode.ts`).
- Cap each slot's length. Beds loop on the device anyway: lobby, question,
  reveal and scores at most 30 s; countdown and end at most 5 s. Put the
  limits next to `FINAL_CLIP_MS`.
- Keep the original upload only if the editor needs it; devices get the
  small file.
- Existing skins: one-off re-encode of the stored slots (script or
  migration), since only new uploads would get the small files otherwise.

**Done when:** every slot a device loads is ≤ 250 KB (30 s × 64 kbit/s), and
the RPTZRU skin's slots are re-encoded.

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

## 3. Reactions: 5 per player per 60 s, reset with every question and at the end

Now: `REACTIONS_PER_WINDOW = 5` within `REACTION_WINDOW_MS = 20_000`, a
sliding window per socket (`packages/contract/src/socket.ts` around line 197;
server check in `apps/server/src/modules/realtime/realtime.gateway.ts`, the
`socket.on("reaction")` handler around line 570; client check in
`apps/web/src/components/Game/Flyers.tsx` around line 253).

New:

- `REACTION_WINDOW_MS = 60_000`, still 5 reactions.
- The budget resets on every `question-start` and on the final standings
  (`final` / `game-over`): the player has 5 again right away.
- Keep the budget **per player** (not per socket), so a reconnect doesn't
  give 5 new ones. E.g. a per-room map `playerId → timestamps`, cleared on
  question start and at the end; or a Redis key per player with TTL 60 s if
  several API instances serve one room.
- The client (`Flyers.tsx`) mirrors the rule: also reset its `taps` on
  question start and on the final screen, so it doesn't block buttons the
  server would accept.
- The room-flood rule (`roomAdmitsReaction`, `ROOM_REACTIONS_PER_S`) stays.

**Done when:** a unit test shows: 5 accepted, the 6th dropped, after a new
`question-start` 5 accepted again; after 60 s without a question 5 accepted
again; a reconnect doesn't reset the budget.

## 4. Bench: only 20 % of players send reactions

`tools/buzrrbench/buzrrbench.py`, where the bots are made (around line 858):
`reacting=not args.no_reactions and random.random() < 0.7`.

- Change 0.7 to 0.2.
- Make it an option: `--react-share 0.2` (default 0.2), passed on to the
  child processes like `--no-reactions` (around line 975).
- Bots that react follow the new limit (item 3): at most 5 per 60 s, reset on
  question start and at the end.
- Note it in `tools/buzrrbench/README.md` (options table).

**Done when:** `--users 500` sends reactions from about 100 bots, and the
summary shows no rejected reactions beyond the limit.

## 5. Big rooms: background music on the host only

Even small (item 1), the beds go to every device whose sound is on. With
`playOn: "both"` / `"players"` that is every player.

- From a room size (e.g. more than 100 connected players, a constant in the
  contract) the beds (lobby, question, reveal, scores) play on the host
  only. Players keep the short effects (countdown, end) and the question
  clips.
- `apps/web/src/lib/sound/director.tsx` decides per slot; the player count
  comes from the lobby/snapshot.
- Mention it in the sound-skin editor ("in Räumen über 100 Spielern läuft
  die Hintergrundmusik nur beim Host").

**Done when:** at 500 bots with a music skin no player device loads the
lobby/question/reveal/scores bed.

## 6. Serve `/uploads` apart from the sockets

At 500 players the downloads (even small ones) share the server's line with
the WebSocket traffic.

- Check the proxy in front of the API: limits for parallel connections and
  bandwidth on `/uploads`, and long cache headers (`Cache-Control: public,
  max-age=31536000, immutable`; the file names are content keys).
- Better: put `/uploads` behind a CDN or a separate static host, so a
  download burst can't slow down the game sockets.

**Done when:** at 500 bots with a music skin the `question-start` spread stays
under 1 s and unexpected disconnects are under 1 %.

---

After each item:

- Run `yarn check-types`, `yarn lint`, `yarn workspace server test` and
  `yarn workspace web test`.
- Update `docs/architecture/realtime.md` where it describes the changed
  behaviour.
- Commit with the bench numbers before and after.
