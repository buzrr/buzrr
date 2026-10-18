# buzrrbench

Load test for a Buzrr classic room: N simulated players join by room code, pop
lobby bubbles (sending `bubble-stats`) until the host starts, then answer every
question at random after 0.5–20 s (late answers on purpose; rejections counted).
Each player picks three reaction emojis (mostly smileys) and taps one now and
then in the lobby — sometimes a burst. During the game few tap: 3 % of the
players 1–3 times 10 s into a question, 10 % right after the answer is shown.

Every player also downloads what its browser would, with its own cache: the
play context and the quiz's sound skin, question images, the question sound's
encrypted clips when `preload` announces them (asking the server for a
download slot first and waiting for `preload-go` when queued, reporting
`preload-status`, so the countdown waits for slow devices), and — on devices
where game sounds are on — the skin's sound files (all at once in the lobby,
through the room's `skin` download slot, like the browser) and the preloaded
final song. Like the web client, a failed download is retried up to 5 times
after a random, growing pause (0.4–1.2 s, 0.8–2.4 s, …); a clip given up still
reports `done` with `failed: true`. The summary counts `download slot:
queued` / `at once`, the `download slot wait`, `download retries` and
`downloads failed after 6 tries`.

Prints latencies (HTTP create/join/context, socket connect, request-sync RTT,
submit-answer ack, downloads per kind, preload hint → clips downloaded), the
broadcast spread per question, MB downloaded per kind and how long countdowns
waited for downloads.

## Setup (WSL / Ubuntu)

```sh
sudo apt install python3-venv          # once
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Run

```sh
.venv/bin/python buzrrbench.py                       # asks for URL, code, users
.venv/bin/python buzrrbench.py --url https://quiz.woikn.de --code ABC123 --users 100 --ramp 20
```

| Option                | Default   | What                                                                          |
| --------------------- | --------- | ----------------------------------------------------------------------------- |
| `--kbps N`            | unlimited | Download bandwidth per player (kbit/s), e.g. `2000` for a weak phone/Wi-Fi.   |
| `--sound-optin F`     | `0.3`     | Share of players who switch sound on when the quiz plays it on the host only. |
| `--no-assets`         |           | No downloads at all (sockets only, like before).                              |
| `--no-reactions`      |           | Players send no reactions.                                                    |
| `--react-share F`     | `0.2`     | Share of players who send reactions at all (within the room's budget).        |
| `--timeout-after SEC` |           | With `--timeout-users`: when players time out (seconds after the start).      |
| `--timeout-users N`   | `0`       | That many connected players freeze then: no heartbeat, answers or reactions.  |
| `--probe-bots N`      | `20`      | Random players that probe the `request-sync` round trip in the lobby (10 s).  |
| `--procs N`           | `1`       | Split the players over N processes; one summary. Use it above ~200 players.   |

Frozen players are like a locked phone: the socket still answers the transport
ping, so only the server's heartbeat check (35 s after the last beat) can drop
them, and once dropped they stay away. The summary shows how long that took
(`frozen -> dropped by server`) and how many were never dropped.

```sh
.venv/bin/python buzrrbench.py --code ABC123 --users 50 --timeout-after 90 --timeout-users 5
```

## Big runs

One Python process (one asyncio loop) can't keep up with more than ~200
players: its own lag then shows up as server latency. Above that use
`--procs` — e.g. `--users 500 --procs 4` runs 125 players per process (the ramp
is split too) and merges their numbers into one summary. All players still
share the machine's uplink: with downloads on, 500 phones' worth of sound and
image downloads through one home connection measure the uplink, not the
server — use `--no-assets` or `--kbps` to separate the two.

```sh
.venv/bin/python buzrrbench.py --code ABC123 --users 500 --procs 4 --ramp 40
```

The run ends by itself 30 s after 95 % of the connected players are done (game
over, dropped, kicked); `bots without game end` counts the rest.

Host the quiz in the browser, start the bench, wait until the players appear in
the lobby, then start the game. Ctrl+C stops early and still prints the summary.
Bench players leave the room when the run ends (they stay as guest players in
the database, like any guest).
