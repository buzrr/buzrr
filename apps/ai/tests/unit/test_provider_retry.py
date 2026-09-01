"""Retry and error-classification behaviour for the Gemini provider.

A provider quota blip used to permanently fail a document: every attempt landed
inside the same exhausted minute, and the exhausted error was reported as a
generic 502. These tests pin the three parts of that fix — classification, the
`retryDelay` hint, and a background budget that outlives a per-minute window.
"""

import asyncio
import contextlib
import time

from tenacity import RetryCallState

from buzrr_ai.config import get_settings
from buzrr_ai.errors import UpstreamError, UpstreamRateLimited, UpstreamTimeout
from buzrr_ai.providers.gemini import (
    GeminiEmbeddings,
    _classify,
    _retry_after,
    _retry_background,
    _retry_interactive,
    _Retryable,
    _retrying,
    _TokenBucket,
    _wait,
)

QUOTA_ERROR = (
    "429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'You exceeded your "
    "current quota', 'status': 'RESOURCE_EXHAUSTED', 'details': [{'@type': "
    "'type.googleapis.com/google.rpc.RetryInfo', 'retryDelay': '27s'}]}}"
)


def test_a_quota_error_is_not_reported_as_a_broken_service() -> None:
    classified = _classify(Exception(QUOTA_ERROR))
    assert isinstance(classified, UpstreamRateLimited)
    # 429, not 502: ingestion keys off this to requeue instead of failing.
    assert classified.status_code == 429


def test_other_upstream_failures_still_classify_as_they_did() -> None:
    assert isinstance(_classify(Exception("503 unavailable")), UpstreamError)
    assert isinstance(_classify(Exception("deadline exceeded")), UpstreamTimeout)


def test_the_providers_own_retry_delay_is_parsed() -> None:
    assert _retry_after(Exception(QUOTA_ERROR)) == 27.0
    assert _retry_after(Exception("500 internal")) is None


def _state(attempt: int, exc: BaseException) -> RetryCallState:
    state = RetryCallState(retry_object=None, fn=None, args=(), kwargs={})  # type: ignore[arg-type]
    state.attempt_number = attempt
    state.set_exception((type(exc), exc, None))  # type: ignore[arg-type]
    return state


def test_the_hinted_delay_wins_over_plain_backoff() -> None:
    wait = _wait(75)
    hinted = _Retryable(QUOTA_ERROR, retry_after=27.0)
    # Early attempts back off by seconds; the hint is what actually clears the
    # window, so it has to win.
    assert wait(_state(1, hinted)) >= 28.0


def test_a_hint_can_never_park_a_call_past_its_budget() -> None:
    wait = _wait(20)
    absurd = _Retryable("429 quota", retry_after=3600.0)
    assert wait(_state(1, absurd)) <= 20.0


def test_background_ingestion_outlasts_a_per_minute_quota_window() -> None:
    """The regression this whole change exists for.

    The old budget was 4 attempts capped at 20s — under a minute in total, so a
    per-minute quota could not possibly have reset before the last attempt.
    """
    waits = [_wait(75)(_state(n, _Retryable("429 quota"))) for n in range(1, 6)]
    assert sum(waits) > 60

    def deadline(policy: object) -> float:
        stops = policy.stop.stops  # type: ignore[attr-defined]
        return max(getattr(s, "max_delay", 0) for s in stops)

    # Background ingestion is allowed to wait out a full window; an interactive
    # call, with a user watching, deliberately is not.
    assert deadline(_retry_background) > 60
    assert deadline(_retry_interactive) < 60


class TestOutboundPacing:
    """We can't raise Google's quota, but we can stop spending it on 429s."""

    @staticmethod
    async def _drain(bucket: _TokenBucket, units: int) -> float:
        start = time.monotonic()
        await bucket.take(units)
        return time.monotonic() - start

    async def test_a_full_bucket_does_not_delay_the_first_call(self) -> None:
        bucket = _TokenBucket(per_minute=600)
        assert await self._drain(bucket, 1) < 0.05

    async def test_spending_the_budget_forces_a_wait(self) -> None:
        # 600/min = 10/s, so 5 tokens past empty costs ~0.5s.
        bucket = _TokenBucket(per_minute=600)
        await bucket.take(600)
        assert 0.3 < await self._drain(bucket, 5) < 1.5

    async def test_an_oversized_ask_is_clamped_rather_than_deadlocking(self) -> None:
        bucket = _TokenBucket(per_minute=5)
        assert await self._drain(bucket, 10_000) < 1.5


async def test_every_attempt_pays_a_token_including_retries() -> None:
    """A retry is another request against the same per-minute window.

    Pacing only the first attempt would let a burst of retries dig the hole
    deeper — which is what the observed 429-429-429-200 pattern was.
    """
    settings = get_settings()
    embeddings = GeminiEmbeddings.__new__(GeminiEmbeddings)
    embeddings._gate = asyncio.Semaphore(1)  # type: ignore[attr-defined]
    embeddings._bucket = _TokenBucket(per_minute=settings.ai_embed_requests_per_minute)  # type: ignore[attr-defined]
    embeddings._model = "fake"  # type: ignore[attr-defined]
    embeddings._dimensions = 8  # type: ignore[attr-defined]

    taken: list[float] = []
    original = embeddings._bucket.take  # type: ignore[attr-defined]

    async def counting_take(units: float) -> None:
        taken.append(units)
        await original(units)

    embeddings._bucket.take = counting_take  # type: ignore[attr-defined, method-assign]

    attempts = {"n": 0}

    class _Client:
        class aio:  # noqa: N801
            class models:  # noqa: N801
                @staticmethod
                async def embed_content(**_: object) -> object:
                    attempts["n"] += 1
                    if attempts["n"] < 3:
                        raise RuntimeError("429 RESOURCE_EXHAUSTED quota")
                    raise RuntimeError("500 internal")  # stop after 3, cheaply

    embeddings._client = _Client()  # type: ignore[attr-defined]

    # A fast budget: this test is about *who pays a token*, not about waiting.
    fast = _retrying(attempts=4, max_wait=0.01, deadline=5)
    with contextlib.suppress(Exception):
        await embeddings._embed(["a"], "RETRIEVAL_QUERY", fast)

    # One token per attempt, not one per call.
    assert len(taken) == attempts["n"] >= 3
