"""Retry, pacing and error mapping shared by every provider.

Nothing here knows which vendor it is talking to: providers raise `_Retryable`
for failures worth another attempt and let `_classify` map whatever is left
onto the service's error envelope.
"""

import asyncio
import math
import re
import time
from collections.abc import Callable

from tenacity import (
    AsyncRetrying,
    RetryCallState,
    retry_if_exception_type,
    stop_after_attempt,
    stop_after_delay,
    wait_exponential_jitter,
)

from buzrr_ai.errors import UpstreamError, UpstreamRateLimited, UpstreamTimeout


class _Retryable(Exception):
    """Transient upstream failure worth another attempt."""

    def __init__(self, message: str, *, retry_after: float | None = None) -> None:
        super().__init__(message)
        # Seconds the provider itself asked us to wait, when it said so.
        self.retry_after = retry_after


_RATE_LIMIT_MARKERS = ("429", "rate limit", "resource_exhausted", "quota")
_TRANSIENT_MARKERS = (*_RATE_LIMIT_MARKERS, "503", "unavailable", "500", "internal")

# Gemini returns a `RetryInfo` detail (`'retryDelay': '27s'`) on a 429. It is a
# far better number than anything we could guess, so prefer it when present.
_RETRY_DELAY_HINT = re.compile(r"retryDelay['\"]?:\s*['\"]?(\d+(?:\.\d+)?)s")


def _is_rate_limited(exc: BaseException) -> bool:
    text = str(exc).lower()
    return any(marker in text for marker in _RATE_LIMIT_MARKERS)


def _is_transient(exc: BaseException) -> bool:
    text = str(exc).lower()
    return any(marker in text for marker in _TRANSIENT_MARKERS)


def _retry_after(exc: BaseException) -> float | None:
    match = _RETRY_DELAY_HINT.search(str(exc))
    return float(match.group(1)) if match else None


def _classify(exc: Exception) -> Exception:
    """Map SDK errors onto our envelope.

    The Nest service does this by substring-matching the message; there is no
    better handle available on the SDK's generic errors, so the same heuristic
    applies — but only after tenacity has already exhausted its retries.
    """
    text = str(exc).lower()
    if "timeout" in text or "timed out" in text or "deadline" in text:
        return UpstreamTimeout()
    if _is_rate_limited(exc):
        # Deliberately not a 502: a quota blip is not a broken service, and
        # ingestion requeues on this rather than failing the document.
        return UpstreamRateLimited()
    return UpstreamError()


def _wait(max_wait: float) -> Callable[[RetryCallState], float]:
    """Exponential backoff, overridden by the provider's own `retryDelay`."""
    fallback = wait_exponential_jitter(initial=2, max=max_wait)

    def compute(state: RetryCallState) -> float:
        base = float(fallback(state))
        exc = state.outcome.exception() if state.outcome is not None else None
        hint = getattr(exc, "retry_after", None)
        if hint is None:
            return base
        # A second of slack past the hint; still bounded, so an absurd hint
        # can't park a request for an hour.
        return min(max(float(hint) + 1.0, base), max_wait)

    return compute


def _retrying(*, attempts: int, max_wait: float, deadline: float) -> AsyncRetrying:
    """A retry budget, applied at the call site as `await policy(fn, *args)`."""
    return AsyncRetrying(
        retry=retry_if_exception_type((_Retryable, TimeoutError)),
        stop=stop_after_attempt(attempts) | stop_after_delay(deadline),
        wait=_wait(max_wait),
        reraise=True,
    )


# Two budgets, because the two callers have opposite constraints.
#
# Interactive calls (generation, query embedding) sit inside an HTTP request with
# a user watching, so they give up quickly and let the caller retry.
_retry_interactive = _retrying(attempts=4, max_wait=20, deadline=45)
# Document embedding runs in the worker under a 900s job timeout. The old budget
# here was ~15s across 4 attempts — shorter than the 60s a per-minute quota needs
# to reset, so every attempt landed inside the same exhausted window and a
# transient 429 permanently failed the document.
_retry_background = _retrying(attempts=6, max_wait=75, deadline=300)


class _TokenBucket:
    """Paces our own outbound calls so we stop *causing* 429s.

    Retrying alone makes this worse, not better: a retry is itself a request
    against the same per-minute budget, so a burst of them digs the hole deeper.

    Cost is one token per API call, whatever batch it carries. Google no longer
    publishes how embedding calls are metered and probing a nearly-spent key gave
    contradictory readings, so this deliberately meters the one thing we can see
    and control — how often we call — rather than modelling their accounting.
    Batching stays worthwhile under either interpretation.

    In-process on purpose: the worker is the only heavy consumer, so it holding
    itself under the budget is what leaves room for the API process's occasional
    one-off query. A cross-process limiter would need Redis and buy little.
    """

    def __init__(self, per_minute: int) -> None:
        self._capacity = float(max(1, per_minute))
        self._rate = self._capacity / 60.0
        self._tokens = self._capacity
        self._updated = time.monotonic()
        self._lock = asyncio.Lock()

    async def take(self, units: float) -> None:
        # An ask bigger than the bucket would never be satisfiable; clamp rather
        # than deadlock, and let the retry budget handle the fallout.
        units = min(float(units), self._capacity)
        while True:
            async with self._lock:
                now = time.monotonic()
                self._tokens = min(
                    self._capacity, self._tokens + (now - self._updated) * self._rate
                )
                self._updated = now
                if self._tokens >= units:
                    self._tokens -= units
                    return
                delay = (units - self._tokens) / self._rate
            await asyncio.sleep(delay)


def _l2_normalize(vector: list[float]) -> list[float]:
    """Re-normalise after MRL truncation.

    `gemini-embedding-001` only returns unit-length vectors at its native 3072
    dimensions. Truncating to 768 breaks that, and cosine distance in pgvector
    assumes it — so normalising here is required, not cosmetic.
    """
    norm = math.sqrt(sum(component * component for component in vector))
    if norm == 0:
        return vector
    return [component / norm for component in vector]
