# folke-pr — big rooms, protected answers, sound, German UI

One pull request for everything built on the fork `git.ashberg.de/folke/buzrr`
and run live on quiz.woikn.de. It replaces ~27 smaller branches (`feat/*`,
`fix/*`, `chore/*`) that were split out of the same work and all depend on each
other. The full history is kept, so every step can still be reviewed on its
own.

- Base: `main` at `bf3f78f`
- Size: about 95 commits, 311 files, +22.8k / −1.9k lines
- Note: upstream `buzrr/buzrr` has moved on since `bf3f78f`, so this branch
  probably needs a merge with the current upstream `main` before it can go
  there.

---

## Bug fixes

### Large rooms (tested with 500 simulated players)

Measured with `tools/buzrrbench` (new, see below) against quiz.woikn.de.

- **Joins under a crowd.** A QR-code crowd joining at once got HTTP 500s:
  serialization conflicts in the SERIALIZABLE join transaction.
  - Joins now lock the room's row (`SELECT … FOR UPDATE`, ReadCommitted)
    while the room cap is checked.
  - The browser retries network and 5xx errors with backoff.
  - The Postgres pool size is configurable (`DB_POOL_MAX`).
- **Heartbeat.** Players beat every 10 s; a device that misses three beats is
  dropped after 35 s.
  - In the lobby it is removed from the roster.
  - In a game it shows as offline.
  - The online count everyone sees goes down.
- **Rejoin keeps the score.** A player who leaves and comes back gets their
  points and answers back.
- **Smaller broadcasts.**
  - The host gets the full leaderboard; players get the top 10 plus the total.
  - A player's own place comes once per question with `answer-result`,
    instead of one extra message per player.
  - Lobby bubble-game totals reach the host as one batch a second per room.
  - Reactions have a budget per player, by room size, fresh with every
    question, and the room has a flood limit.
- **Downloads no longer swamp the server.**
  - Everything a game needs loads in the lobby: question clips and pictures,
    the final song and the skin files.
  - Downloads go through download slots per room (`MAX_PARALLEL_DOWNLOADS`,
    `MAX_PARALLEL_AUDIO_DOWNLOADS`).
  - Clips are 64 kbit/s mono. Players get small skin files; the host keeps
    full quality.
  - The host sees who is ready, and the start waits for the downloads, at
    most 30 s.
- **Room size per plan** from the environment (`MAX_PLAYERS_FREE`,
  `MAX_PLAYERS_PRO`, `MAX_PLAYERS_NOBILLING`).

Bench, 510 players (500 active, 10 freeze and must be dropped):

| Metric                 | before (`main` + first fixes) | after               |
| ---------------------- | ----------------------------- | ------------------- |
| join HTTP 500          | 409 retried, 82 failed        | 0                   |
| players who got in     | 418                           | 493                 |
| join p50 / p95         | 4.1 s / 13 s                  | 0.2 s / 1.4 s       |
| `request-sync` p50     | 3.4 s                         | 1.8 s               |
| frozen players dropped | —                             | 10 / 10 after ~30 s |

At 250 players with a music skin, after the lobby preload: answer ack p50
155 ms / p95 404 ms, no ack timeouts. Broadcast spread was under 0.3 s for
every event, with 4 unexpected disconnects and 2 failed downloads out of
871 MB.

### SQL

- Join serialization conflicts are replaced by the per-room row lock (above).
- The room cap is enforced inside the locked transaction, so concurrent
  joins can't overshoot it. A spec covers the cap under parallel joins.

### Answers can't be read early

- **Question media is encrypted.** Question sounds, question pictures and
  the final song are stored and served AES-256-GCM encrypted
  (`common/storage/clip-crypto.ts`).
  - Devices can download them ahead of time but can't play or show them.
  - The key comes with `question-start`, the reveal or `finalSoundKey`.
- **The public player context no longer contains the quiz's questions**
  (`a882bb2`).
- **The verdict stays hidden.** While a question is open or closed, a
  player's verdict, points and rank are masked until the reveal.

### Uploaded assets are not public

- `/uploads/<key>` on the local store is only served with an HMAC signature
  (`?sig=<expiry>.<hmac>`, keyed from `BETTER_AUTH_SECRET`, valid 6 h;
  `common/storage/asset-signing.ts`).
- Signatures go only to whoever may see the asset:
  - players and the host of a room, when the question opens;
  - signed-in REST callers who are allowed to see it.
- The database keeps only the bare URL.
- Uploads are cached as immutable.

### Smaller fixes

- Question sounds play through Web Audio (Safari blocked them without a
  gesture).
- The final leaderboard no longer closes early.
- A game can start without players.
- A host stranded on the game screen of a room that never started goes back
  to the lobby.
- iOS: stopping sound works.
- Stale tabs reload after a new version is deployed.

---

## New features

- **German UI.** The language comes from a cookie or the browser, with a
  selector in the settings. AI writes questions in the UI language.
- **Music questions.** A question can carry an MP3 (WAV, OGG, FLAC, M4A and
  WebM are converted with ffmpeg).
  - The waveform editor sets the part that plays while the question is open
    and a reveal cue.
  - It plays the part as a cue is set or moved.
  - You can drag and drop a picture or audio file onto the question editor.
- **Sound skins** for the whole game: lobby, countdown, question, last
  question, end tusch, reveal, scoreboard and final music.
  - Built-in skins: TV Game Show (with recordings), Arcade and Chill. You
    can upload your own skins and clone a built-in one.
  - Each slot has playback options (volume, fade-in, repeat, start, end
    alignment, extend) and a waveform cue editor.
  - Configurable lobby cues (join, bubble, reaction).
  - Each skin has its own final anthem.
  - Placement: host screen / players' devices / both / off. Players can
    opt in, and there is a music on/off switch.
- **New question type `type_answer`.** Players type the answer, either as
  free text or in fixed-length boxes. Several accepted answers are allowed.
- **Moderated mode.** The host steps through "Be prepared!", the question,
  "time's up", the answer and the scores. Each step is optional, and the
  host has a keyboard (Space = next, Esc = skip).
- **Live reactions.** Fixed base emojis plus up to four of the player's
  own. They float up on the host's screen, and the final top three can send
  without limit.
- **Lobby bubble game.** The waiting list is ranked by bubble score.
- **Avatar skins**: original, comic, crazy food, funny faces, or up to 20
  of your own (auto-cropped). Players can switch avatar in the lobby.
- **Quiz logo and default logo** (drag and drop). **Game defaults** (logo,
  audio skin, avatar skin) apply wherever a quiz says "Default".
- **Quiz admin tools.**
  - Edit the title and description in place.
  - Duplicate a quiz, delete played games, disable or enable questions.
  - "∞" answer time.
  - Quizzes sorted by last edit or last game.
  - Owners see every run of their quiz.
- **Multiple choice** with 2–8 options. The reveal shows the fastest three
  right answers, and players see their own answer time.
- **Join flow.** The join code is sent by itself at the sixth character, and
  keys typed anywhere go into the code. The player profile is remembered.
- **Self-hosting / instance options**: `BILLING`, `DUELS`, `PRIVATE_BUZZ`,
  `TITLE`, `CONTACT_EMAIL`. The superadmin can manage users (create local
  accounts, reset passwords).
- **Pro gating** for own skins and logos. The superadmin can share skins
  with everyone.
- **`tools/buzrrbench`**, a Python load test. Bots join, pop bubbles, react,
  download every asset and answer.
  - Answers support `type_answer`.
  - Options: heartbeats, `--timeout-after/--timeout-users`, `--procs`,
    `--probe-bots`, `--react-share`.
  - It reports latencies, broadcast spread and download stats.

---

## Upgrade notes

- **12 Prisma migrations** in `packages/prisma/migrations/`, from
  `20261017000001_quiz_settings` to `20261019000007_question_media_clip`.
  They add quiz settings, question audio and clips, sound skins and their
  options, quiz logo, disabled questions and user preferences.
- **New env vars** (all optional, with defaults):
  - `DB_POOL_MAX`
  - `MAX_PLAYERS_FREE`, `MAX_PLAYERS_PRO`, `MAX_PLAYERS_NOBILLING`
  - `MAX_PARALLEL_DOWNLOADS`, `MAX_PARALLEL_AUDIO_DOWNLOADS`
  - `NEXT_PUBLIC_BUILD_ID`
  - `BILLING`, `DUELS`, `PRIVATE_BUZZ`, `TITLE`, `CONTACT_EMAIL`
- **ffmpeg** is needed on the server for audio uploads. The server image
  already has it.
- **Docs** updated: `docs/architecture/realtime.md`, `data.md` and
  `backend.md`, `docs/self-hosting.md` (room size, `DB_POOL_MAX`), and
  `docs/CONTEXT.md`.

## Testing

Run on this branch:

- `yarn check-types`: clean
- `yarn lint`: 0 errors (39 warnings, as before)
- `yarn workspace web test`: 24 / 24 passed
- `yarn workspace server test` against a local Postgres: 264 passed,
  7 skipped. The two skipped specs (`answer-cost`, `rejoin-score`) need a
  real Redis and are opt-in via `REDIS_TEST_URL`.
- Live on quiz.woikn.de with buzrrbench runs of 50, 110, 250, 260 and 510
  players.
