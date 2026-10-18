#!/usr/bin/env python3
"""
buzrrbench - load test for a Buzrr classic room.

Joins N simulated players to a room (by game code), pops lobby bubbles until
the host starts the game, then answers every question at random after a random
0.5-20 s delay (late answers are sent on purpose; their rejections are counted).
Every player picks three reaction emojis (mostly smileys) and taps one now and
then in the lobby, sometimes a burst. During the game few do: 3 % of the players
tap 1-3 times 10 s into a question, 10 % right after the answer is shown.

Each player also downloads what its browser would, with its own cache:
  - the player context and the quiz's sound skin (if it is a user skin)
  - question images, as each question opens
  - question sounds: the encrypted clips announced by `preload` (with
    `preload-status` progress reports, like a phone, so the countdown can wait
    for slow devices; with the server's download slots a device first asks
    for one and waits for `preload-go`), or an external sound file when the
    question opens
  - the skin's sound files for each phase and the preloaded final song, on
    devices where game sounds are on (`--sound-optin` decides how many players
    switch sound on when the quiz plays it on the host only)

Measures:
  - HTTP latency: create player, join room
  - socket connect latency (connect + first state-sync)
  - request-sync -> state-sync round trip (lobby, a few probe bots every 10 s)
  - submit-answer ack latency (accepted / rejected by reason)
  - broadcast spread: how far apart the players received question-start /
    question-end / phase-change for the same question
  - downloads: latency and bytes per kind, preload hint -> clips downloaded,
    question sounds ready / still loading when the question opened, how long
    countdowns waited for downloads

Usage:
  python3 buzrrbench.py [--url https://quiz.woikn.de] [--code ABC123] [--users 50]
                        [--kbps 2000] [--sound-optin 0.3] [--no-assets] [--no-reactions]
                        [--timeout-after 60 --timeout-users 5] [--procs 4] [--probe-bots 20]

With --timeout-after/--timeout-users, that many connected players "freeze" at
that point (like a locked phone): they send nothing any more — no heartbeat,
answers, reactions — while the socket still answers the transport ping, so
only the server's heartbeat check can drop them. Dropped, they stay away.
Missing values are asked for interactively.

The run ends by itself once 95 % of the connected players are done (game over,
dropped, kicked) plus 30 s for stragglers; the rest count as "bots without game
end". With --procs N the players are split over N processes (one asyncio loop
can't keep up beyond ~200 bots); the parent merges their numbers into one summary.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import signal
import statistics
import string
import subprocess
import sys
import tempfile
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
SYNC_PROBE_EVERY = 10.0  # only --probe-bots players probe
HEARTBEAT_EVERY = 10.0  # HEARTBEAT_INTERVAL_MS in the contract
# The run stops this long after DONE_SHARE of the connected players are done.
DONE_SHARE = 0.95
DONE_GRACE = 30.0
# While queued for a download slot: "still here, loaded 0" this often.
QUEUED_REPORT_EVERY = 1.5
SLOT_ACK_TIMEOUT = 10.0
SLOT_GIVE_UP = 90.0  # like the web client: start anyway after this long
SKIN_KEEPALIVE_EVERY = 4.0  # holding the skin slot: ask again, refreshes it
MUSIC_SLOTS = {"lobby", "question", "scores", "final"}
# During the game, reactions are rare: this share of all players taps 1-3
# times once a question has run QUESTION_REACT_AFTER s, and this share
# right after the answer is shown. In the lobby they tap regularly.
QUESTION_REACT_SHARE = 0.03
QUESTION_REACT_AFTER = 10.0
REVEAL_REACT_SHARE = 0.10
PRELOAD_REPORT_EVERY = 0.4  # like the web client's throttle
# Tries per download, like the web client (lib/sound/preload.ts).
DOWNLOAD_TRIES = 6
CHUNK = 64 * 1024

BUILTIN_SKINS = {"builtin:show", "builtin:arcade", "builtin:chill"}
DEFAULT_EMOJIS = ["👍", "❤️", "😂"]
EMOJI_POOL = [
    "😀", "😂", "🤣", "😅", "😍", "🥰", "😎", "🤔", "😱", "😭",
    "🥳", "🤯", "🙈", "😬", "🤩", "😇", "👍", "❤️", "🔥", "🎉", "👏",
]
# Phases in which the player screen shows the reaction bar (inline in the lobby).
REACTION_PHASES = {"idle", "lobby", "starting", "question", "reveal", "closed", "scores", "ready", "final"}


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

    # --procs: children dump raw numbers, the parent merges them.
    def dump(self) -> dict:
        return {
            "lat": self.lat, "errors": self.errors, "counts": self.counts,
            "recv": [[ev, q, ts] for (ev, q), ts in self.recv.items()],
            "bytes": self.bytes,
            "waiting_for": list(self.waiting_for.items()),
            "wait_ms": list(self.wait_ms.items()),
        }

    def merge(self, d: dict) -> None:
        for k, v in d["lat"].items():
            self.lat[k].extend(v)
        self.errors.update(d["errors"])
        self.counts.update(d["counts"])
        self.bytes.update(d["bytes"])
        for ev, q, ts in d["recv"]:
            self.recv[(ev, q)].extend(ts)  # time.time(): comparable across processes
        for q, n in d["waiting_for"]:
            self.waiting_for[q] = self.waiting_for.get(q, 0) + n
        for q, ms in d["wait_ms"]:
            self.wait_ms[q] = max(self.wait_ms.get(q, 0.0), ms)


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
    ever_connected: bool = False
    game_ended: bool = False  # saw game-over / game-session-ended
    probe: bool = False  # one of the --probe-bots request-sync probes
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
    failed_keys: set = field(default_factory=set)  # clips given up after all tries
    progress: dict = field(default_factory=dict)  # bare url -> (loaded, total, done)
    tracked: tuple | None = None  # (qIndex, [bare urls], hint time)
    last_report: float = 0.0
    bw_free_at: float = 0.0  # when the device's downlink is free again (--kbps)
    tasks: set = field(default_factory=set)
    question_audio: dict | None = None
    seen_q: set = field(default_factory=set)
    wait_started: dict = field(default_factory=dict)  # qIndex -> first "waiting for downloads"
    slot_go: dict = field(default_factory=dict)  # (kind, qIndex) -> asyncio.Event (preload-go)
    frozen_at: float = 0.0  # --timeout-*: when this player stopped sending (perf_counter)

    # -- helpers ------------------------------------------------------------------

    @property
    def frozen(self) -> bool:
        return self.frozen_at > 0

    def freeze(self) -> None:
        """Stop sending anything, like a page frozen on a locked phone."""
        self.frozen_at = time.perf_counter()
        # A frozen page can't reconnect either once the server drops it.
        self.sio.reconnection = False
        M.counts["players timed out (frozen)"] += 1

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

    async def http_json(self, method: str, path: str, metric: str, retries: int = 0, **kw):
        """JSON request; with `retries`, 5xx and network errors are retried like
        the web client does (0.8 s, 1.6 s, 3.2 s + jitter)."""
        for attempt in range(retries + 1):
            t0 = time.perf_counter()
            last = attempt == retries
            try:
                async with self.http.request(method, f"{self.base}{path}", **kw) as r:
                    body = await r.json(content_type=None)
                    M.add(metric, (time.perf_counter() - t0) * 1000)
                    if r.status < 400:
                        return body
                    if r.status < 500 or last:
                        M.err(f"{metric}: HTTP {r.status} {str(body)[:80]}")
                        return None
                    what = f"HTTP {r.status}"
            except Exception as e:  # noqa: BLE001
                if last:
                    M.err(f"{metric}: {type(e).__name__}")
                    return None
                what = type(e).__name__
            M.counts[f"{metric}: retried after {what}"] += 1
            await asyncio.sleep(0.4 * 2 ** (attempt + 1) + random.uniform(0, 0.4))
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
            "POST", "/api/game-sessions/join", "http join-room", retries=3,
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
        self.connected = self.ever_connected = True
        bubbles = asyncio.create_task(self.pop_bubbles())
        probe = asyncio.create_task(self.sync_probe() if self.probe else asyncio.sleep(0))
        reacts = asyncio.create_task(self.react())
        beats = asyncio.create_task(self.heartbeat())
        self.prefetch_skin()
        await self.done.wait()
        bubbles.cancel()
        probe.cancel()
        reacts.cancel()
        beats.cancel()
        # A bot that gives up (error, kicked, game over) leaves for real: no
        # auto-reconnect, so the host sees it go offline instead of a silent
        # player that keeps coming back without answering.
        try:
            self.sio.reconnection = False
            if self.sio.connected:
                await self.sio.disconnect()
        except Exception:
            pass

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
            task = asyncio.create_task(self._download_with_retry(url, key, kind))
            self.cache[key] = task
            self.tasks.add(task)
            task.add_done_callback(self.tasks.discard)
        return task

    async def _download_with_retry(self, url: str, key: str, kind: str) -> int:
        """Like the web client: up to DOWNLOAD_TRIES tries, a random, growing
        pause between them; a clip given up still reports "done" (failed),
        so the countdown doesn't wait for it."""
        for attempt in range(1, DOWNLOAD_TRIES + 1):
            try:
                return await self._download(url, key, kind)
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001
                if attempt == DOWNLOAD_TRIES:
                    M.counts[f"downloads failed after {DOWNLOAD_TRIES} tries: {kind}"] += 1
                    self.progress[key] = (0, 0, True)
                    self.failed_keys.add(key)
                    self.notify()
                    raise
                M.counts[f"download retries: {kind}"] += 1
                await asyncio.sleep((0.4 + random.random() * 0.8) * attempt)
        return 0

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
            if done and any(k in self.failed_keys for k in keys):
                payload["failed"] = True
            self.spawn(self._emit("preload-status", payload))

    async def _emit(self, event: str, payload) -> None:
        if self.frozen:
            return
        try:
            await self.sio.emit(event, payload) if payload is not None else await self.sio.emit(event)
            M.counts[f"{event} sent"] += 1
        except Exception:  # noqa: BLE001
            M.err(f"{event} emit failed")

    def on_preload(self, data: dict) -> None:
        M.counts["preload hints received"] += 1
        if not self.assets or not self.sound_here(data.get("playOn")):
            return
        urls = data.get("urls") or []
        q = data["qIndex"]
        self.tracked = (q, [u.split("?")[0] for u in urls], time.perf_counter())
        self.notify()
        if all(u.split("?")[0] in self.cache for u in urls):
            self.start_preload(urls)
        else:
            self.spawn(self._preload_in_turn(q, urls))

    def start_preload(self, urls: list) -> None:
        for u in urls:
            self.download(u, "question sound (preload)")
        self.notify()

    async def wait_for_slot(self, kind: str, q: int, waiting=None) -> None:
        """Like the web client: ask for a download slot (kind "question" /
        "skin") and wait for `preload-go` if queued; `waiting` runs every
        QUEUED_REPORT_EVERY s meanwhile."""
        t0 = time.perf_counter()
        go = self.slot_go.setdefault((kind, q), asyncio.Event())
        go.clear()
        try:
            ack = await self.sio.call(
                "preload-slot", {"qIndex": q, "kind": kind}, timeout=SLOT_ACK_TIMEOUT
            )
        except Exception:  # noqa: BLE001 - no answer (older server): just go
            ack = {"go": True}
        if ack.get("go"):
            M.counts[f"download slot ({kind}): at once"] += 1
            return
        M.counts[f"download slot ({kind}): queued"] += 1
        deadline = t0 + SLOT_GIVE_UP
        while not go.is_set() and time.perf_counter() < deadline:
            try:
                await asyncio.wait_for(go.wait(), QUEUED_REPORT_EVERY)
            except asyncio.TimeoutError:
                if waiting:
                    waiting()
        if not go.is_set():
            M.counts[f"download slot ({kind}): gave up waiting"] += 1
        M.add(f"download slot wait ({kind})", (time.perf_counter() - t0) * 1000)

    async def _preload_in_turn(self, q: int, urls: list) -> None:
        def keepalive():
            self.last_report = 0.0  # "loaded 0" again, not throttled away
            self.notify()
        await self.wait_for_slot("question", q, keepalive)
        self.start_preload(urls)

    def prefetch_skin(self) -> None:
        """Like the web client: the skin's files once, in the lobby, through
        the room's skin download slot (only what plays on this device)."""
        if not self.assets or not self.skin or not self.sound_here("quiz"):
            return
        slots = self.skin.get("slots") or {}
        music = self.sound.get("music", True) is not False
        urls = [
            u for slot, u in slots.items()
            if u and (music or slot not in MUSIC_SLOTS)
            and not (slot == "final" and self.skin.get("finalClipUrl"))
        ]
        if urls:
            self.spawn(self.fetch_skin_files(urls, "skin sound (prefetch)"))

    async def fetch_skin_files(self, urls: list, kind: str) -> None:
        missing = [u for u in urls if u.split("?")[0] not in self.cache]
        if not missing:
            return
        await self.wait_for_slot("skin", 0)

        async def keepalive():
            while True:
                await asyncio.sleep(SKIN_KEEPALIVE_EVERY)
                self.spawn(self._emit_ack("preload-slot", {"qIndex": 0, "kind": "skin"}))
        alive = asyncio.create_task(keepalive())
        try:
            for u in missing:  # one after the other, like the browser
                try:
                    await self.fetch(u, kind)
                except Exception:  # noqa: BLE001 - counted in the download
                    pass
        finally:
            alive.cancel()
            self.spawn(self._emit("slot-done", {"qIndex": 0, "kind": "skin"}))

    async def _emit_ack(self, event: str, payload) -> None:
        if self.frozen or not self.sio.connected:
            return
        try:
            await self.sio.call(event, payload, timeout=SLOT_ACK_TIMEOUT)
        except Exception:  # noqa: BLE001
            pass

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
            # Like the browser: through the skin slot unless already here.
            if slots.get(slot):
                self.spawn(self.fetch_skin_files([slots[slot]], f"skin sound ({slot})"))
        if final_url and old in ("idle", "lobby") and new not in ("idle", "lobby"):
            self.spawn(self._preload_final(final_url))

    async def _preload_final(self, url: str) -> None:
        # Each device at a random moment within a minute of the start.
        await asyncio.sleep(random.uniform(0, 60))
        await self.fetch_skin_files([url], "final song (preload)")

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

        @s.on("preload-go")
        async def _preload_go(data):
            key = (data.get("kind") or "question", data["qIndex"])
            self.slot_go.setdefault(key, asyncio.Event()).set()

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
            if self.reacting and random.random() < QUESTION_REACT_SHARE:
                self.spawn(self.tap(delay=QUESTION_REACT_AFTER + random.uniform(0, 3),
                                    taps=random.randint(1, 3)))

        @s.on("question-end")
        async def _qend(data):
            self.set_phase("reveal")
            M.recv[("question-end", data["index"])].append(time.time())
            audio = self.question_audio
            if data.get("audioRevealKey") and audio and self.sound_here(audio.get("playOn")):
                # Decrypting the reveal clip: preloaded, unless the device joined late.
                self.download(audio.get("revealUrl"), "question sound (late)")
            # The answer is out: a good moment for a smiley.
            if self.reacting and random.random() < REVEAL_REACT_SHARE:
                self.spawn(self.tap(delay=random.uniform(0.5, 3.0), taps=random.randint(1, 3)))

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
            self.game_ended = True
            self.done.set()

        @s.on("game-session-ended")
        async def _ended(_data=None):
            M.counts["game-session-ended received"] += 1
            self.game_ended = True
            self.done.set()

        @s.on("player-removed")
        async def _removed(data):
            if data.get("id") == self.player_id:
                M.err("kicked/banned by host")
                self.done.set()

        @s.event
        async def connect():
            # The web client beats right on every (re)connect.
            self.spawn(self._emit("heartbeat", None))

        @s.event
        async def disconnect(*_args):
            if self.frozen and not self.done.is_set():
                # The server noticed: stay away (a frozen page can't reconnect).
                M.add("frozen -> dropped by server", (time.perf_counter() - self.frozen_at) * 1000)
                M.counts["frozen players dropped by server"] += 1
                self.connected = False
                self.done.set()
                return
            if not self.done.is_set():
                M.counts["socket disconnects (unexpected)"] += 1

    async def heartbeat(self) -> None:
        """Like the web client: one beat on connect, then every 10 s (missing
        three gets the socket dropped by the server)."""
        while True:
            if self.sio.connected:
                await self._emit("heartbeat", None)
            await asyncio.sleep(HEARTBEAT_EVERY)

    async def pop_bubbles(self) -> None:
        """Lobby: 'pop' a few bubbles (some misses) and report once a second."""
        while True:
            await asyncio.sleep(1.0)
            if self.frozen or self.phase not in ("idle", "lobby"):
                continue
            self.hits += random.randint(0, 3)
            self.misses += random.randint(0, 2)
            try:
                await self.sio.emit("bubble-stats", {"hits": self.hits, "misses": self.misses})
                M.counts["bubble-stats sent"] += 1
            except Exception:  # noqa: BLE001
                M.err("bubble-stats emit failed")

    async def react(self) -> None:
        """Lobby: now and then a smiley from the player's three — sometimes a
        burst. During the game only the question / reveal moments tap."""
        if not self.reacting:
            return
        while True:
            await asyncio.sleep(random.uniform(6, 30))
            if self.phase in ("idle", "lobby"):
                await self.tap()

    async def tap(self, delay: float = 0.0, taps: int | None = None) -> None:
        await asyncio.sleep(delay)
        if self.frozen or not self.reactions_on or self.phase not in REACTION_PHASES:
            return
        emoji = random.choice(self.emojis)
        burst = taps or (random.randint(3, 10) if random.random() < 0.15 else random.choice([1, 1, 1, 2]))
        for _ in range(burst):
            try:
                await self.sio.emit("reaction", {"emoji": emoji})
                M.counts["reactions sent"] += 1
            except Exception:  # noqa: BLE001
                M.err("reaction emit failed")
            await asyncio.sleep(random.uniform(0.06, 0.15))

    async def sync_probe(self) -> None:
        """Lobby only: request-sync round trip as a latency probe (--probe-bots
        players only — every bot syncing every few seconds was itself a load)."""
        await asyncio.sleep(random.uniform(0, SYNC_PROBE_EVERY))
        while True:
            if not self.frozen and self.phase in ("idle", "lobby") and not self.sync_sent:
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
        if self.frozen:
            M.counts["answers not sent (frozen)"] += 1
            return
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
            if self.frozen:
                if self.sio.connected:
                    M.counts["frozen players never dropped"] += 1
                    await self.sio.disconnect()
                return
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


def report(started: float, no_game_end: int | None = None) -> None:
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
    if no_game_end is not None:
        M.counts["bots without game end"] = no_game_end
    if M.counts:
        print("\nCounts")
        for k, v in sorted(M.counts.items()):
            print(f"  {k:60s} {v}")
    if M.errors:
        print("\nErrors")
        for k, v in M.errors.most_common():
            print(f"  {k:60s} {v}")
    print()


def parse_args() -> argparse.Namespace:
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
    ap.add_argument("--timeout-after", type=float, metavar="SEC",
                    help="after SEC seconds, --timeout-users players freeze (stop sending, heartbeat too)")
    ap.add_argument("--timeout-users", type=int, default=0, metavar="N",
                    help="how many connected players freeze at --timeout-after (default 0)")
    ap.add_argument("--probe-bots", type=int, default=20, metavar="N",
                    help="players that probe the request-sync round trip in the lobby (default 20)")
    ap.add_argument("--procs", type=int, default=1, metavar="N",
                    help="split the players over N processes (use for more than ~200; default 1)")
    # internal: set by the parent for its --procs children
    ap.add_argument("--child-out", help=argparse.SUPPRESS)
    ap.add_argument("--first-idx", type=int, default=1, help=argparse.SUPPRESS)
    ap.add_argument("--label", default="", help=argparse.SUPPRESS)
    return ap.parse_args()


async def run_bots(args: argparse.Namespace, base: str, code: str, users: int) -> int | None:
    """Runs this process's players; returns how many never saw the game end
    (None if none did — e.g. stopped in the lobby)."""
    tag = f"[{args.label}] " if args.label else ""
    started = time.time()
    conn = aiohttp.TCPConnector(limit=0)
    async with aiohttp.ClientSession(connector=conn, timeout=aiohttp.ClientTimeout(total=30)) as http:
        bots = [
            Bot(
                args.first_idx + i, base, code, http,
                assets=not args.no_assets,
                kbps=args.kbps,
                reacting=not args.no_reactions and random.random() < 0.7,
                sound_pref=True if random.random() < args.sound_optin else None,
                emojis=list(DEFAULT_EMOJIS) if random.random() < 0.3 else random.sample(EMOJI_POOL, 3),
            )
            for i in range(users)
        ]
        for b in random.sample(bots, min(args.probe_bots, users)):
            b.probe = True
        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, stop.set)
            except NotImplementedError:
                pass

        async def progress():
            while True:
                await asyncio.sleep(5)
                phases = Counter(b.phase for b in bots if b.connected)
                acc = M.counts["answers accepted"]
                rej = sum(v for k, v in M.counts.items() if k.startswith("answers rejected"))
                print(
                    f"{tag}[{time.time() - started:6.0f}s] connected={sum(b.connected for b in bots)}/{users} "
                    + (f"frozen={sum(b.frozen and b.connected for b in bots)} " if args.timeout_users else "")
                    + f"phases={dict(phases)} answers ok={acc} rejected={rej} "
                    f"downloaded={sum(M.bytes.values()) / 1e6:.1f}MB errors={sum(M.errors.values())}",
                    flush=True,
                )

        async def time_out_some():
            await asyncio.sleep(max(0.0, args.timeout_after - (time.time() - started)))
            alive = [b for b in bots if b.connected and not b.frozen and not b.done.is_set()]
            picked = random.sample(alive, min(args.timeout_users, len(alive)))
            for b in picked:
                b.freeze()
            print(
                f"{tag}[{time.time() - started:6.0f}s] {len(picked)} players froze "
                f"(no heartbeat, answers, reactions) - the server should drop them",
                flush=True,
            )

        async def end_when_mostly_done():
            # Once the game is over for most players, don't hang on a few that
            # never got the end (lost socket, stuck): give them DONE_GRACE, stop.
            while True:
                await asyncio.sleep(1)
                joined = [b for b in bots if b.ever_connected]
                if not joined or not any(b.game_ended for b in joined):
                    continue
                # floor: with --procs a child may hold few bots (9 of 10 counts)
                if sum(b.done.is_set() for b in joined) >= int(DONE_SHARE * len(joined)):
                    break
            print(f"{tag}[{time.time() - started:6.0f}s] {DONE_SHARE:.0%} done - "
                  f"stopping in {DONE_GRACE:.0f}s", flush=True)
            await asyncio.sleep(DONE_GRACE)
            stop.set()

        tasks = []
        prog = asyncio.create_task(progress())
        ender = asyncio.create_task(end_when_mostly_done())
        freezer = asyncio.create_task(time_out_some()) if args.timeout_users else None
        print(f"{tag}{users} players joining {code} on {base} - waiting for the host to start (Ctrl+C to stop)",
              flush=True)
        try:
            for b in bots:
                tasks.append(asyncio.create_task(b.run()))
                if stop.is_set():
                    break
                await asyncio.sleep(1.0 / args.ramp)
            all_done = asyncio.gather(*tasks)
            stopper = asyncio.create_task(stop.wait())
            await asyncio.wait({all_done, stopper}, return_when=asyncio.FIRST_COMPLETED)
            all_done.add_done_callback(lambda f: f.cancelled() or f.exception())
        except asyncio.CancelledError:
            # python-socketio's own Ctrl+C handler cancels every task; still report.
            pass
        for t in (prog, ender, freezer):
            if t:
                t.cancel()
        joined = [b for b in bots if b.ever_connected]
        no_end = sum(not b.game_ended for b in joined) if any(b.game_ended for b in joined) else None
        for b in bots:
            b.done.set()
        try:
            await asyncio.wait_for(
                asyncio.gather(*(b.close() for b in bots), return_exceptions=True), timeout=5
            )
            await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=5)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            pass
    return no_end


def split(total: int, parts: int) -> list[int]:
    return [total // parts + (1 if i < total % parts else 0) for i in range(parts)]


def run_parent(args: argparse.Namespace, base: str, code: str, users: int) -> None:
    """--procs: start the children, wait, merge their numbers, one summary."""
    started = time.time()
    procs = min(args.procs, users)
    sizes = split(users, procs)
    freeze = split(args.timeout_users, procs)
    probes = split(args.probe_bots, procs)
    tmp = tempfile.mkdtemp(prefix="buzrrbench-")
    children = []
    first = 1
    for i, n in enumerate(sizes):
        out = os.path.join(tmp, f"p{i + 1}.json")
        cmd = [sys.executable, os.path.abspath(__file__),
               "--url", base, "--code", code, "--users", str(n),
               "--ramp", str(args.ramp / procs), "--kbps", str(args.kbps),
               "--sound-optin", str(args.sound_optin), "--probe-bots", str(probes[i]),
               "--child-out", out, "--first-idx", str(first), "--label", f"p{i + 1}"]
        if args.no_assets:
            cmd.append("--no-assets")
        if args.no_reactions:
            cmd.append("--no-reactions")
        if args.timeout_users and freeze[i]:
            cmd += ["--timeout-after", str(args.timeout_after), "--timeout-users", str(freeze[i])]
        children.append((out, subprocess.Popen(cmd)))
        first += n

    # Ctrl+C reaches the children through the terminal's process group; the
    # parent only waits (a no-op handler, not SIG_IGN, so children keep theirs).
    signal.signal(signal.SIGINT, lambda *_: None)
    signal.signal(signal.SIGTERM, lambda *_: [p.send_signal(signal.SIGTERM) for _, p in children])
    no_end = None
    for i, (out, p) in enumerate(children):
        while p.poll() is None:
            try:
                p.wait()
            except InterruptedError:
                pass
        try:
            with open(out, encoding="utf-8") as f:
                d = json.load(f)
        except (OSError, ValueError):
            M.err(f"process p{i + 1}: no result (exit {p.returncode})")
            continue
        M.merge(d["metrics"])
        if d["no_game_end"] is not None:
            no_end = (no_end or 0) + d["no_game_end"]
    report(started, no_end)


def main() -> None:
    args = parse_args()
    base = (args.url or ask("Server URL", "https://quiz.woikn.de")).rstrip("/")
    code = (args.code or ask("Room code")).strip().upper()
    users = args.users or int(ask("Parallel users", "20"))
    if not code or users < 1:
        sys.exit("room code and a positive number of users are required")
    if (args.timeout_after is None) != (args.timeout_users < 1):
        sys.exit("--timeout-after and --timeout-users go together")
    if args.procs > 1 and not args.child_out:
        run_parent(args, base, code, users)
        return
    started = time.time()
    no_end = None
    try:
        no_end = asyncio.run(run_bots(args, base, code, users))
    except KeyboardInterrupt:
        pass
    if args.child_out:
        with open(args.child_out, "w", encoding="utf-8") as f:
            json.dump({"metrics": M.dump(), "no_game_end": no_end}, f)
    else:
        report(started, no_end)


if __name__ == "__main__":
    main()
