#!/usr/bin/env python3
"""
buzrrbench - load test for a Buzrr classic room.

Joins N simulated players to a room (by game code), pops lobby bubbles until
the host starts the game, then answers every question at random after a random
0.5-20 s delay (late answers are sent on purpose; their rejections are counted).
Every player picks three reaction emojis (mostly smileys) and taps one now and
then during the game, sometimes a burst, often right after an answer is shown.

Each player also downloads what its browser would, with its own cache:
  - the player context and the quiz's sound skin (if it is a user skin)
  - question images, as each question opens
  - question sounds: the encrypted clips announced by `preload` (with
    `preload-status` progress reports, like a phone, so the countdown can wait
    for slow devices), or an external sound file when the question opens
  - the skin's sound files for each phase and the preloaded final song, on
    devices where game sounds are on (`--sound-optin` decides how many players
    switch sound on when the quiz plays it on the host only)

Measures:
  - HTTP latency: create player, join room
  - socket connect latency (connect + first state-sync)
  - request-sync -> state-sync round trip (lobby, every few seconds)
  - submit-answer ack latency (accepted / rejected by reason)
  - broadcast spread: how far apart the players received question-start /
    question-end / phase-change for the same question
  - downloads: latency and bytes per kind, preload hint -> clips downloaded,
    question sounds ready / still loading when the question opened, how long
    countdowns waited for downloads

Usage:
  python3 buzrrbench.py [--url https://quiz.woikn.de] [--code ABC123] [--users 50]
                        [--kbps 2000] [--sound-optin 0.3] [--no-assets] [--no-reactions]
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
from urllib.parse import urljoin

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
PRELOAD_REPORT_EVERY = 0.4  # like the web client's throttle
CHUNK = 64 * 1024

BUILTIN_SKINS = {"builtin:show", "builtin:arcade", "builtin:chill"}
DEFAULT_EMOJIS = ["👍", "❤️", "😂"]
EMOJI_POOL = [
    "😀", "😂", "🤣", "😅", "😍", "🥰", "😎", "🤔", "😱", "😭",
    "🥳", "🤯", "🙈", "😬", "🤩", "😇", "👍", "❤️", "🔥", "🎉", "👏",
]
# Phases in which the player screen shows the reaction bar.
REACTION_PHASES = {"starting", "question", "reveal", "closed", "scores", "ready", "final"}


# -- metrics -------------------------------------------------------------------


class Metrics:
    def __init__(self) -> None:
        self.lat: dict[str, list[float]] = defaultdict(list)  # ms
        self.errors: Counter[str] = Counter()
        self.counts: Counter[str] = Counter()
        # (event, qIndex) -> receive timestamps (s), for broadcast spread
        self.recv: dict[tuple[str, int], list[float]] = defaultdict(list)
        self.bytes: Counter[str] = Counter()
        # qIndex -> most devices a countdown waited for / longest wait (ms)
        self.waiting_for: dict[int, int] = {}
        self.wait_ms: dict[int, float] = {}

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
    if t == "type_answer":
        pattern = q.get("pattern")
        if pattern:
            # Fixed length: letters fill the boxes word by word (like TypeAnswer.tsx);
            # some players don't fill them all.
            total = sum(pattern)
            n = total if random.random() < 0.8 else random.randint(1, total)
            chars = random.choices(string.ascii_lowercase + "äöü", k=n)
            words, at = [], 0
            for size in pattern:
                if chars[at : at + size]:
                    words.append("".join(chars[at : at + size]))
                at += size
            return {"guess": " ".join(words)}
        # Free text: one to three words, trimmed, at most maxLength.
        guess = " ".join(
            "".join(random.choices(string.ascii_letters + "äöüß", k=random.randint(2, 10)))
            for _ in range(random.choice([1, 1, 2, 3]))
        )
        return {"guess": guess[: int(q.get("maxLength") or 100)].strip()}
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
    assets: bool = True
    kbps: float = 0.0  # download limit per device, 0 = none
    reacting: bool = True
    sound_pref: bool | None = None  # the device's sound switch (None = default)
    sound: dict = field(default_factory=dict)  # quiz sound settings
    reactions_on: bool = True
    skin: dict | None = None
    emojis: list = field(default_factory=lambda: list(DEFAULT_EMOJIS))
    cache: dict = field(default_factory=dict)  # bare url -> download task
    progress: dict = field(default_factory=dict)  # bare url -> (loaded, total, done)
    tracked: tuple | None = None  # (qIndex, [bare urls], hint time)
    last_report: float = 0.0
    bw_free_at: float = 0.0  # when the device's downlink is free again (--kbps)
    tasks: set = field(default_factory=set)
    question_audio: dict | None = None
    seen_q: set = field(default_factory=set)
    wait_started: dict = field(default_factory=dict)  # qIndex -> first "waiting for downloads"

    # -- helpers ------------------------------------------------------------------

    def spawn(self, coro) -> None:
        t = asyncio.create_task(coro)
        self.tasks.add(t)
        t.add_done_callback(self.tasks.discard)

    def sound_here(self, play_on: str | None) -> bool:
        """Whether sound with this placement plays on this device (see director.tsx)."""
        if play_on == "quiz" or play_on is None:
            play_on = self.sound.get("playOn", "host")
        if play_on in ("both", "players"):
            return self.sound_pref if self.sound_pref is not None else True
        if play_on == "host" and self.sound.get("playerOptIn", True):
            return bool(self.sound_pref)
        return False

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
        await self.load_context()

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

    async def load_context(self) -> None:
        """What the player page loads: the play context (quiz settings) and the skin."""
        ctx = await self.http_json(
            "GET", f"/api/game-sessions/player-play/{self.player_id}", "http player-play"
        )
        settings = (((ctx or {}).get("game") or {}).get("quiz") or {}).get("settings") or {}
        self.sound = settings.get("sound") or {}
        self.reactions_on = settings.get("reactions", True) is not False
        skin_id = self.sound.get("skin", "builtin:show")
        if self.assets and skin_id not in BUILTIN_SKINS and self.sound_here("quiz"):
            self.skin = await self.http_json(
                "GET", f"/api/sound-skins/{skin_id}", "http sound-skin",
                headers={"Authorization": f"Bearer {self.token}"},
            )

    # -- downloads ------------------------------------------------------------------

    def fetch(self, url: str, kind: str) -> asyncio.Task:
        """One download per URL per device (browser cache), keyed without the signature."""
        key = url.split("?")[0]
        task = self.cache.get(key)
        if task is None or (task.done() and (task.cancelled() or task.exception())):
            task = asyncio.create_task(self._download(url, key, kind))
            self.cache[key] = task
            self.tasks.add(task)
            task.add_done_callback(self.tasks.discard)
        return task

    async def _download(self, url: str, key: str, kind: str) -> int:
        full = urljoin(self.base + "/", url)
        t0 = time.perf_counter()
        loaded = 0
        try:
            async with self.http.get(
                full, timeout=aiohttp.ClientTimeout(total=None, sock_connect=15, sock_read=30)
            ) as r:
                if r.status >= 400:
                    M.err(f"download {kind}: HTTP {r.status}")
                    raise RuntimeError(f"HTTP {r.status}")
                total = int(r.headers.get("Content-Length") or 0)
                self.progress[key] = (0, total, False)
                self.notify()
                async for chunk in r.content.iter_chunked(CHUNK):
                    loaded += len(chunk)
                    self.progress[key] = (loaded, total, False)
                    self.notify()
                    if self.kbps:
                        # One downlink per device, shared by its parallel downloads.
                        now = time.perf_counter()
                        self.bw_free_at = max(now, self.bw_free_at) + len(chunk) * 8 / 1000 / self.kbps
                        await asyncio.sleep(self.bw_free_at - now)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001
            if not isinstance(e, RuntimeError):
                M.err(f"download {kind}: {type(e).__name__}")
            self.progress.pop(key, None)
            raise
        self.progress[key] = (loaded, total or loaded, True)
        self.notify()
        M.add(f"download {kind}", (time.perf_counter() - t0) * 1000)
        M.counts[f"downloads: {kind}"] += 1
        M.bytes[kind] += loaded
        return loaded

    def download(self, url: str | None, kind: str) -> None:
        if url and self.assets:
            self.fetch(url, kind).add_done_callback(lambda t: t.cancelled() or t.exception())

    def notify(self) -> None:
        """`preload-status` for the tracked question, throttled; "done" always."""
        if not self.tracked or self.tracked[2] is None:
            return  # nothing tracked, or "done" already reported
        q_index, keys, hint_at = self.tracked
        loaded = total = 0
        done = True
        for k in keys:
            lo, to, d = self.progress.get(k, (0, 0, False))
            loaded += lo
            total += to
            done = done and d
        now = time.perf_counter()
        if not done and now - self.last_report < PRELOAD_REPORT_EVERY:
            return
        self.last_report = now
        if done:
            M.add("preload hint -> clips downloaded", (now - hint_at) * 1000)
            self.tracked = (q_index, keys, None)
        if self.sio.connected:
            payload = {"qIndex": q_index, "loaded": loaded, "total": total, "done": done}
            self.spawn(self._emit("preload-status", payload))

    async def _emit(self, event: str, payload) -> None:
        try:
            await self.sio.emit(event, payload)
            M.counts[f"{event} sent"] += 1
        except Exception:  # noqa: BLE001
            M.err(f"{event} emit failed")

    def on_preload(self, data: dict) -> None:
        M.counts["preload hints received"] += 1
        if not self.assets or not self.sound_here(data.get("playOn")):
            return
        urls = data.get("urls") or []
        self.tracked = (data["qIndex"], [u.split("?")[0] for u in urls], time.perf_counter())
        for u in urls:
            self.download(u, "question sound (preload)")
        self.notify()

    def on_question(self, q_index: int, question: dict) -> None:
        """What the question screen loads as it opens: image, sound."""
        if not self.assets or q_index in self.seen_q:
            return
        self.seen_q.add(q_index)
        self.question_audio = question.get("audio")
        if question.get("media"):
            self.download(question["media"], "question image")
        audio = question.get("audio")
        if audio and self.sound_here(audio.get("playOn")):
            key = audio["url"].split("?")[0]
            if audio.get("encrypted"):
                ready = self.progress.get(key, (0, 0, False))[2]
                M.counts["question sound ready when it opened" if ready
                         else "question sound still loading when it opened"] += 1
                self.download(audio["url"], "question sound (late)")
            else:
                self.download(audio["url"], "question sound (file)")

    def on_phase(self, old: str, new: str) -> None:
        """Skin files a device with sound on fetches as phases change (see director.tsx)."""
        if not self.assets or old == new or not self.sound_here("quiz"):
            return
        slots = (self.skin or {}).get("slots") or {}
        bed = {"idle": "lobby", "lobby": "lobby", "ready": "lobby", "question": "question",
               "scores": "scores", "final": "final", "ended": "final"}.get(new)
        final_url = (self.skin or {}).get("finalClipUrl")
        if bed == "final" and final_url:
            # The preloaded encrypted song plays instead (cached by now, mostly).
            bed = None
            self.download(final_url, "final song (late)")
        wanted = [bed] if bed else []
        if new == "starting":
            wanted.append("countdown")
        if old == "question" and new in ("closed", "reveal", "scores"):
            wanted.append("end")
        if new == "reveal":
            wanted.append("reveal")
        for slot in wanted:
            self.download(slots.get(slot), f"skin sound ({slot})")
        if final_url and old in ("idle", "lobby") and new not in ("idle", "lobby"):
            self.spawn(self._preload_final(final_url))

    async def _preload_final(self, url: str) -> None:
        # Each device at a random moment within a minute of the start.
        await asyncio.sleep(random.uniform(0, 60))
        self.download(url, "final song (preload)")

    def set_phase(self, phase: str) -> None:
        old, self.phase = self.phase, phase
        self.on_phase(old, phase)

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
            self.set_phase(data.get("phase", self.phase))
            if self.phase == "question" and data.get("question"):
                self.on_question(data["qIndex"], data["question"])
                self.schedule_answer(data["qIndex"], data["question"])

        @s.on("game-started")
        async def _started(_data=None):
            self.set_phase("starting")
            M.recv[("game-started", 0)].append(time.time())

        @s.on("phase-change")
        async def _phase(data):
            self.set_phase(data["phase"])
            q = data["qIndex"]
            if data.get("waitingFor") is not None:
                # Countdown over, still waiting for devices' downloads.
                M.waiting_for[q] = max(M.waiting_for.get(q, 0), data["waitingFor"])
                self.wait_started.setdefault(q, time.perf_counter())
                return
            M.recv[(f"phase-change:{data['phase']}", q)].append(time.time())

        @s.on("preload")
        async def _preload(data):
            self.on_preload(data)

        @s.on("question-start")
        async def _qstart(data):
            q = data["index"]
            if q in self.wait_started:
                ms = (time.perf_counter() - self.wait_started.pop(q)) * 1000
                M.wait_ms[q] = max(M.wait_ms.get(q, 0.0), ms)
            self.set_phase("question")
            M.recv[("question-start", q)].append(time.time())
            self.on_question(q, data["question"])
            self.schedule_answer(q, data["question"])

        @s.on("question-end")
        async def _qend(data):
            self.set_phase("reveal")
            M.recv[("question-end", data["index"])].append(time.time())
            audio = self.question_audio
            if data.get("audioRevealKey") and audio and self.sound_here(audio.get("playOn")):
                # Decrypting the reveal clip: preloaded, unless the device joined late.
                self.download(audio.get("revealUrl"), "question sound (late)")
            # The answer is out: a good moment for a smiley.
            if self.reacting and random.random() < 0.3:
                self.spawn(self.tap(delay=random.uniform(0.5, 3.0)))

        @s.on("answer-result")
        async def _res(data):
            M.counts["answer-result " + ("correct" if data.get("isCorrect") else "wrong/none")] += 1

        @s.on("leaderboard")
        async def _lb(data):
            if data.get("isFinal"):
                self.set_phase("final")

        @s.on("game-over")
        async def _over(_data=None):
            self.set_phase("ended")
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
        """Now and then a smiley from the player's three — sometimes a burst."""
        if not self.reacting:
            return
        while True:
            await asyncio.sleep(random.uniform(6, 30))
            await self.tap()

    async def tap(self, delay: float = 0.0) -> None:
        await asyncio.sleep(delay)
        if not self.reactions_on or self.phase not in REACTION_PHASES:
            return
        emoji = random.choice(self.emojis)
        burst = random.randint(3, 10) if random.random() < 0.15 else random.choice([1, 1, 1, 2])
        for _ in range(burst):
            try:
                await self.sio.emit("reaction", {"emoji": emoji})
                M.counts["reactions sent"] += 1
            except Exception:  # noqa: BLE001
                M.err("reaction emit failed")
            await asyncio.sleep(random.uniform(0.06, 0.15))

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
        for t in list(self.tasks):
            t.cancel()
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
    if M.bytes:
        print("\nDownloads")
        for kind, n in sorted(M.bytes.items()):
            print(f"  {kind:38s} files={M.counts[f'downloads: {kind}']:6d}  {n / 1e6:10.2f} MB")
        print(f"  {'total':38s} {'':12s} {sum(M.bytes.values()) / 1e6:10.2f} MB")
    if M.waiting_for:
        print("\nCountdowns waiting for downloads")
        for q in sorted(M.waiting_for):
            print(f"  q{q + 1:<3d} up to {M.waiting_for[q]:4d} devices, "
                  f"waited {M.wait_ms.get(q, 0.0):8.1f} ms")
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
    ap.add_argument("--kbps", type=float, default=0.0,
                    help="download bandwidth per player in kbit/s, e.g. 2000 for a weak phone (default: unlimited)")
    ap.add_argument("--sound-optin", type=float, default=0.3,
                    help="share of players who switch sound on when the quiz plays it on the host only (default 0.3)")
    ap.add_argument("--no-assets", action="store_true", help="skip all downloads (images, sounds)")
    ap.add_argument("--no-reactions", action="store_true", help="players send no reactions")
    args = ap.parse_args()

    base = (args.url or ask("Server URL", "https://quiz.woikn.de")).rstrip("/")
    code = (args.code or ask("Room code")).strip().upper()
    users = args.users or int(ask("Parallel users", "20"))
    if not code or users < 1:
        sys.exit("room code and a positive number of users are required")

    started = time.time()
    conn = aiohttp.TCPConnector(limit=0)
    async with aiohttp.ClientSession(connector=conn, timeout=aiohttp.ClientTimeout(total=30)) as http:
        bots = [
            Bot(
                i + 1, base, code, http,
                assets=not args.no_assets,
                kbps=args.kbps,
                reacting=not args.no_reactions and random.random() < 0.7,
                sound_pref=True if random.random() < args.sound_optin else None,
                emojis=list(DEFAULT_EMOJIS) if random.random() < 0.3 else random.sample(EMOJI_POOL, 3),
            )
            for i in range(users)
        ]
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
                    f"phases={dict(phases)} answers ok={acc} rejected={rej} "
                    f"downloaded={sum(M.bytes.values()) / 1e6:.1f}MB errors={sum(M.errors.values())}",
                    flush=True,
                )

        prog = asyncio.create_task(progress())
        print(f"{users} players joining {code} on {base} - waiting for the host to start (Ctrl+C to stop)")
        all_done = asyncio.gather(*tasks)
        stopper = asyncio.create_task(stop.wait())
        try:
            await asyncio.wait({all_done, stopper}, return_when=asyncio.FIRST_COMPLETED)
        except asyncio.CancelledError:
            # python-socketio's own Ctrl+C handler cancels every task; still report.
            pass
        prog.cancel()
        all_done.add_done_callback(lambda f: f.cancelled() or f.exception())
        for b in bots:
            b.done.set()
        try:
            await asyncio.wait_for(
                asyncio.gather(*(b.close() for b in bots), return_exceptions=True), timeout=5
            )
            await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=5)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            pass
    report(started)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
