# buzrrbench

Load test for a Buzrr classic room: N simulated players join by room code, pop
lobby bubbles (sending `bubble-stats`) until the host starts, then answer every
question at random after 0.5–20 s (late answers on purpose; rejections counted).
Each player picks three reaction emojis (mostly smileys) and taps one now and
then during the game — sometimes a burst, often right after the answer is shown.

Every player also downloads what its browser would, with its own cache: the
play context and the quiz's sound skin, question images, the question sound's
encrypted clips when `preload` announces them (reporting `preload-status`, so
the countdown waits for slow devices), and — on devices where game sounds are
on — the skin's sound files per phase and the preloaded final song.

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

| Option            | Default   | What                                                                         |
| ----------------- | --------- | ---------------------------------------------------------------------------- |
| `--kbps N`        | unlimited | Download bandwidth per player (kbit/s), e.g. `2000` for a weak phone/Wi-Fi.  |
| `--sound-optin F` | `0.3`     | Share of players who switch sound on when the quiz plays it on the host only. |
| `--no-assets`     |           | No downloads at all (sockets only, like before).                             |
| `--no-reactions`  |           | Players send no reactions.                                                   |

Host the quiz in the browser, start the bench, wait until the players appear in
the lobby, then start the game. Ctrl+C stops early and still prints the summary.
Bench players leave the room when the run ends (they stay as guest players in
the database, like any guest).
