# buzrrbench

Load test for a Buzrr classic room: N simulated players join by room code, pop
lobby bubbles (sending `bubble-stats`) until the host starts, then answer every
question at random after 0.5–20 s (late answers on purpose; rejections counted).
Prints latencies (HTTP create/join, socket connect, request-sync RTT,
submit-answer ack) and the broadcast spread per question at the end.

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

Host the quiz in the browser, start the bench, wait until the players appear in
the lobby, then start the game. Ctrl+C stops early and still prints the summary.
Bench players leave the room when the run ends (they stay as guest players in
the database, like any guest).
