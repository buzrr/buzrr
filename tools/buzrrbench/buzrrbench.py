#!/usr/bin/env python3
"""
buzrrbench - load test for a Buzrr classic room.

Joins N simulated players to a room (by game code), pops lobby bubbles until
the host starts the game, then answers every question at random after a random
0.5-20 s delay (late answers are sent on purpose; their rejections are counted).
Players also send live reactions now and then (sometimes a burst of hearts).

Measures:
  - HTTP latency: create player, join room
  - socket connect latency (connect + first state-sync)
  - request-sync -> state-sync round trip (lobby, every few seconds)
  - submit-answer ack latency (accepted / rejected by reason)
  - broadcast spread: how far apart the players received question-start /
    question-end / phase-change for the same question

Usage:
  python3 buzrrbench.py [--url https://quiz.woikn.de] [--code ABC123] [--users 50]
Missing values are asked for interactively.
"""

from __future__ import annotations

import argparse
import asyncio
import random
import signal
import statistics
import string
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field

try:
    import aiohttp
    import socketio
except ImportError:
    sys.exit(
        "Missing dependencies. Install with:\n"
        "  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt\n"
        "  (WSL/Ubuntu: sudo apt install python3-venv first)"
    )

ANSWER_DELAY = (0.5, 20.0)
ACK_TIMEOUT = 15.0
SYNC_PROBE_EVERY = 5.0


# -- metrics -------------------------------------------------------------------


class Metrics:
    def __init__(self) -> None:
        self.lat: dict[str, list[float]] = defaultdict(list)  # ms
        self.errors: Counter[str] = Counter()
        self.counts: Counter[str] = Counter()
        # (event, qIndex) -> receive timestamps (s), for broadcast spread
        self.recv: dict[tuple[str, int], list[float]] = defaultdict(list)

    def add(self, name: str, ms: float) -> None:
        self.lat[name].append(ms)

    def err(self, what: str) -> None:
        self.errors[what] += 1


M = Metrics()


def fmt_stats(values: list[float]) -> str:
    if not values:
        return "-"
    v = sorted(values)

    def pct(p: float) -> float:
        return v[min(len(v) - 1, int(round(p / 100 * (len(v) - 1))))]

    return (
        f"n={len(v):5d}  min={v[0]:7.1f}  avg={statistics.fmean(v):7.1f}  "
        f"p50={pct(50):7.1f}  p95={pct(95):7.1f}  p99={pct(99):7.1f}  max={v[-1]:7.1f}"
    )


# -- random answers --------------------------------------------------------------


def random_answer(q: dict) -> dict | None:
    """An answer of the right shape for the question's type (random choice)."""
    t = q.get("type")
    opts = [o["id"] for o in q.get("options") or []]
    if t == "multiple_choice":
        if not opts:
            return None
        if q.get("multiSelect"):
            k = random.randint(1, len(opts))
            return {"optionIds": random.sample(opts, k)}
        return {"optionId": random.choice(opts)}
    if t == "true_false":
        return {"optionId": random.choice(opts)} if opts else None
    if t == "poll":
        if not opts:
            return None
        k = random.randint(1, len(opts)) if q.get("multiSelect") else 1
        return {"optionIds": random.sample(opts, k)}
    if t == "rating":
        top = 10 if str(q.get("scale")) == "10" else 5
        return {"value": random.randint(1, top)}
    if t == "word_cloud":
        n = random.randint(1, max(1, int(q.get("maxAnswers") or 1)))
        maxlen = int(q.get("maxLength") or 20)
        return {
            "words": [
                "".join(random.choices(string.ascii_lowercase, k=random.randint(3, min(10, maxlen))))
                for _ in range(n)
            ]
        }
    if t == "open_text":
        return {"text": "bench " + "".join(random.choices(string.ascii_lowercase, k=12)), "anonymous": False}
    return None


# -- one simulated player ------------------------------------------------------------


@dataclass
class Bot:
    idx: int
    base: str
    code: str
    http: aiohttp.ClientSession
    sio: socketio.AsyncClient = field(default_factory=lambda: socketio.AsyncClient(reconnection=True))
    player_id: str = ""
    token: str = ""
    phase: str = "idle"
    connected: bool = False
    done: asyncio.Event = field(default_factory=asyncio.Event)
    sync_sent: float = 0.0
    hits: int = 0
    misses: int = 0
    answered_q: set = field(default_factory=set)

    async def http_json(self, method: str, path: str, metric: str, **kw):
        t0 = time.perf_counter()
        try:
            async with self.http.request(method, f"{self.base}{path}", **kw) as r:
                body = await r.json(content_type=None)
                M.add(metric, (time.perf_counter() - t0) * 1000)
                if r.status >= 400:
                    M.err(f"{metric}: HTTP {r.status} {str(body)[:80]}")
                    return None
                return body
        except Exception as e:  # noqa: BLE001
            M.err(f"{metric}: {type(e).__name__}")
            return None

    async def run(self) -> None:
        p = await self.http_json(
            "POST", "/api/players", "http create-player",
            json={"username": f"bench-{self.idx:03d}", "profile": ""},
        )
        if not p:
            self.done.set()
            return
        self.player_id, self.token = p["playerId"], p["accessToken"]
        ok = await self.http_json(
            "POST", "/api/game-sessions/join", "http join-room",
            json={"gameCode": self.code},
            headers={"Authorization": f"Bearer {self.token}"},
        )
        if ok is None:
            self.done.set()
            return

        self.register()
        t0 = time.perf_counter()
        self._connect_t0 = t0
        try:
            await self.sio.connect(
                f"{self.base}?userType=player&gameCode={self.code}",
                auth={"token": self.token},
                transports=["websocket"],
                wait_timeout=20,
            )
        except Exception as e:  # noqa: BLE001
            M.err(f"socket connect: {type(e).__name__} {e}"[:120])
            self.done.set()
            return
        M.add("socket connect", (time.perf_counter() - t0) * 1000)
        self.connected = True
        bubbles = asyncio.create_task(self.pop_bubbles())
        probe = asyncio.create_task(self.sync_probe())
        reacts = asyncio.create_task(self.react())
        await self.done.wait()
        bubbles.cancel()
        probe.cancel()
        reacts.cancel()

    # socket handlers
    def register(self) -> None:
        s = self.sio
        first_sync = {"seen": False}

        @s.on("state-sync")
        async def _sync(data):
            now = time.perf_counter()
            if not first_sync["seen"]:
                first_sync["seen"] = True
                M.add("socket connect -> first state-sync", (now - self._connect_t0) * 1000)
            elif self.sync_sent:
                M.add("request-sync rtt", (now - self.sync_sent) * 1000)
                self.sync_sent = 0.0
            self.phase = data.get("phase", self.phase)
            if self.phase == "question" and data.get("question"):
                self.schedule_answer(data["qIndex"], data["question"])

        @s.on("game-started")
        async def _started(_data=None):
            self.phase = "starting"
            M.recv[("game-started", 0)].append(time.time())

        @s.on("phase-change")
        async def _phase(data):
            self.phase = data["phase"]
            M.recv[(f"phase-change:{data['phase']}", data["qIndex"])].append(time.time())

        @s.on("question-start")
        async def _qstart(data):
            self.phase = "question"
            M.recv[("question-start", data["index"])].append(time.time())
            self.schedule_answer(data["index"], data["question"])

        @s.on("question-end")
        async def _qend(data):
            self.phase = "reveal"
            M.recv[("question-end", data["index"])].append(time.time())

        @s.on("answer-result")
        async def _res(data):
            M.counts["answer-result " + ("correct" if data.get("isCorrect") else "wrong/none")] += 1

        @s.on("leaderboard")
        async def _lb(data):
            if data.get("isFinal"):
                self.phase = "final"

        @s.on("game-over")
        async def _over(_data=None):
            self.phase = "ended"
            M.counts["game-over received"] += 1
            self.done.set()

        @s.on("game-session-ended")
        async def _ended(_data=None):
            M.counts["game-session-ended received"] += 1
            self.done.set()

        @s.on("player-removed")
        async def _removed(data):
            if data.get("id") == self.player_id:
                M.err("kicked/banned by host")
                self.done.set()

        @s.event
        async def disconnect(*_args):
            if not self.done.is_set():
                M.counts["socket disconnects (unexpected)"] += 1

    async def pop_bubbles(self) -> None:
        """Lobby: 'pop' a few bubbles (some misses) and report once a second."""
        while True:
            await asyncio.sleep(1.0)
            if self.phase not in ("idle", "lobby"):
                continue
            self.hits += random.randint(0, 3)
            self.misses += random.randint(0, 2)
            try:
                await self.sio.emit("bubble-stats", {"hits": self.hits, "misses": self.misses})
                M.counts["bubble-stats sent"] += 1
            except Exception:  # noqa: BLE001
                M.err("bubble-stats emit failed")

    async def react(self) -> None:
        """Now and then a reaction tap — sometimes a burst of up to 10 hearts."""
        while True:
            await asyncio.sleep(random.uniform(2, 8))
            burst = random.randint(3, 10) if random.random() < 0.2 else 1
            emoji = random.choice(["👍", "❤️", "😂", "🔥", "🎉"])
            for _ in range(burst):
                try:
                    await self.sio.emit("reaction", {"emoji": emoji})
                    M.counts["reactions sent"] += 1
                except Exception:  # noqa: BLE001
                    M.err("reaction emit failed")
                await asyncio.sleep(0.08)

    async def sync_probe(self) -> None:
        """Lobby only: request-sync round trip as a latency probe."""
        await asyncio.sleep(random.uniform(0, SYNC_PROBE_EVERY))
        while True:
            if self.phase in ("idle", "lobby") and not self.sync_sent:
                self.sync_sent = time.perf_counter()
                try:
                    await self.sio.emit("request-sync")
                except Exception:  # noqa: BLE001
                    M.err("request-sync emit failed")
                    self.sync_sent = 0.0
            await asyncio.sleep(SYNC_PROBE_EVERY)

    def schedule_answer(self, q_index: int, question: dict) -> None:
        if q_index in self.answered_q:
            return
        self.answered_q.add(q_index)
        asyncio.create_task(self.answer(q_index, question))

    async def answer(self, q_index: int, question: dict) -> None:
        delay = random.uniform(*ANSWER_DELAY)
        await asyncio.sleep(delay)
        ans = random_answer(question)
        if ans is None:
            M.counts[f"skipped (unsupported type {question.get('type')})"] += 1
            return
        late = self.phase != "question"
        t0 = time.perf_counter()
        try:
            ack = await self.sio.call(
                "submit-answer", {"qIndex": q_index, "answer": ans}, timeout=ACK_TIMEOUT
            )
        except socketio.exceptions.TimeoutError:
            M.err("submit-answer: ack timeout")
            return
        except Exception as e:  # noqa: BLE001
            M.err(f"submit-answer: {type(e).__name__}")
            return
        ms = (time.perf_counter() - t0) * 1000
        if ack and ack.get("accepted"):
            M.add("submit-answer ack (accepted)", ms)
            M.counts["answers accepted"] += 1
        else:
            M.add("submit-answer ack (rejected)", ms)
            reason = (ack or {}).get("reason", "no ack payload")
            M.counts[f"answers rejected: {reason}{' (sent late)' if late else ''}"] += 1

    async def close(self) -> None:
        try:
            if self.sio.connected:
                await self.sio.emit("leave-room")
                await asyncio.sleep(0.05)
                await self.sio.disconnect()
        except Exception:  # noqa: BLE001
            pass


# -- driver -------------------------------------------------------------------------


def ask(prompt: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default else ""
    val = input(f"{prompt}{suffix}: ").strip()
    return val or (default or "")


def report(started: float) -> None:
    print("\n" + "=" * 100)
    print(f"buzrrbench summary - {time.time() - started:.0f}s run")
    print("=" * 100)
    print("\nLatencies [ms]")
    for name in sorted(M.lat):
        print(f"  {name:38s} {fmt_stats(M.lat[name])}")
    spreads = []
    for (ev, q), ts in sorted(M.recv.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        if len(ts) > 1:
            spreads.append((ev, q, (max(ts) - min(ts)) * 1000, len(ts)))
    if spreads:
        print("\nBroadcast spread (first to last player receiving the same event) [ms]")
        for ev, q, spread, n in spreads:
            print(f"  q{q + 1:<3d} {ev:28s} spread={spread:8.1f}  receivers={n}")
    if M.counts:
        print("\nCounts")
        for k, v in sorted(M.counts.items()):
            print(f"  {k:60s} {v}")
    if M.errors:
        print("\nErrors")
        for k, v in M.errors.most_common():
            print(f"  {k:60s} {v}")
    print()


async def main() -> None:
    ap = argparse.ArgumentParser(description="Buzrr room load test")
    ap.add_argument("--url", help="server URL, e.g. https://quiz.woikn.de")
    ap.add_argument("--code", help="room code (Teilnahmecode)")
    ap.add_argument("--users", type=int, help="number of parallel players")
    ap.add_argument("--ramp", type=float, default=20.0, help="players started per second (default 20)")
    args = ap.parse_args()

    base = (args.url or ask("Server URL", "https://quiz.woikn.de")).rstrip("/")
    code = (args.code or ask("Room code")).strip().upper()
    users = args.users or int(ask("Parallel users", "20"))
    if not code or users < 1:
        sys.exit("room code and a positive number of users are required")

    started = time.time()
    conn = aiohttp.TCPConnector(limit=0)
    async with aiohttp.ClientSession(connector=conn, timeout=aiohttp.ClientTimeout(total=30)) as http:
        bots = [Bot(i + 1, base, code, http) for i in range(users)]
        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, stop.set)
            except NotImplementedError:
                pass

        tasks = []
        for b in bots:
            tasks.append(asyncio.create_task(b.run()))
            await asyncio.sleep(1.0 / args.ramp)

        async def progress():
            while True:
                await asyncio.sleep(5)
                phases = Counter(b.phase for b in bots if b.connected)
                acc = M.counts["answers accepted"]
                rej = sum(v for k, v in M.counts.items() if k.startswith("answers rejected"))
                print(
                    f"[{time.time() - started:6.0f}s] connected={sum(b.connected for b in bots)}/{users} "
                    f"phases={dict(phases)} answers ok={acc} rejected={rej} errors={sum(M.errors.values())}",
                    flush=True,
                )

        prog = asyncio.create_task(progress())
        print(f"{users} players joining {code} on {base} - waiting for the host to start (Ctrl+C to stop)")
        all_done = asyncio.gather(*tasks)
        stopper = asyncio.create_task(stop.wait())
        await asyncio.wait({all_done, stopper}, return_when=asyncio.FIRST_COMPLETED)
        prog.cancel()
        for b in bots:
            b.done.set()
        await asyncio.gather(*(b.close() for b in bots), return_exceptions=True)
        await asyncio.gather(*tasks, return_exceptions=True)
    report(started)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
