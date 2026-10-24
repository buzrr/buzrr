# buzrrbench

Load test for a Buzrr classic room: N simulated players join by room code, wait
in the lobby until the host starts, then answer every question at random after
0.5–20 s (late answers on purpose; rejections counted).

Every player also downloads what its browser would, with its own cache: the
play context and question images.

Prints latencies (HTTP create/join/context, socket connect, request-sync RTT,
submit-answer ack, downloads per kind), the broadcast spread per question and
MB downloaded per kind.

## Setup (WSL / Ubuntu)

```sh
sudo apt install python3-venv          # once
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Run

```sh
.venv/bin/python buzrrbench.py                       # asks for URL, code, users
.venv/bin/python buzrrbench.py --url https://www.buzrr.in --code ABC123 --users 100 --ramp 20
.venv/bin/python buzrrbench.py --url https://www.buzrr.in/join/ABC123 --users 100   # join link: code from the URL
```

The URL may be the web app's: when it doesn't answer a Socket.IO handshake,
the bench looks for the game server next to it (port 3001 beside a local web
app on 3000, or `api.<host>`).

| Option                | Default   | What                                                                         |
| --------------------- | --------- | ---------------------------------------------------------------------------- |
| `--kbps N`            | unlimited | Download bandwidth per player (kbit/s), e.g. `2000` for a weak phone/Wi-Fi.  |
| `--no-assets`         |           | No downloads at all (sockets only, like before).                             |
| `--timeout-after SEC` |           | With `--timeout-users`: when players time out (seconds after the start).     |
| `--timeout-users N`   | `0`       | That many connected players freeze then: no heartbeat or answers.            |
| `--probe-bots N`      | `20`      | Random players that probe the `request-sync` round trip in the lobby (10 s). |
| `--procs N`           | `1`       | Split the players over N processes; one summary. Use it above ~200 players.  |

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
share the machine's uplink: with downloads on, 500 phones' worth of image
downloads through one home connection measure the uplink, not the
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
