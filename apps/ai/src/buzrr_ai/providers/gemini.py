"""Gemini implementations of the provider protocols (`google-genai` SDK)."""

import asyncio
import math
import re
import time
from collections.abc import Callable
from typing import Any, TypeVar

import structlog
from google import genai
from google.genai import types as genai_types
from pydantic import BaseModel, ValidationError
from tenacity import (
    AsyncRetrying,
    RetryCallState,
    retry_if_exception_type,
    stop_after_attempt,
    stop_after_delay,
    wait_exponential_jitter,
)

from buzrr_ai.config import Settings
from buzrr_ai.errors import UpstreamError, UpstreamRateLimited, UpstreamTimeout

log = structlog.get_logger(__name__)

TModel = TypeVar("TModel", bound=BaseModel)

# Gemini's embed_content takes a batch; keep requests well under the payload cap.
_EMBED_BATCH = 100


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


class GeminiEmbeddings:
    def __init__(self, settings: Settings) -> None:
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.ai_embedding_model
        self._dimensions = settings.ai_embedding_dimensions
        # arq runs several ingest jobs at once (`max_jobs`), and without a gate
        # they all hit the embeddings endpoint together — a burst that trips a
        # per-minute quota no amount of retrying can dodge. Serialised by
        # default; raise it once the project is off a free-tier key.
        self._gate = asyncio.Semaphore(max(1, settings.ai_embed_max_concurrency))
        self._bucket = _TokenBucket(settings.ai_embed_requests_per_minute)

    @property
    def model(self) -> str:
        return self._model

    @property
    def dimensions(self) -> int:
        return self._dimensions

    async def _embed(
        self,
        texts: list[str],
        task_type: str,
        retrying: AsyncRetrying = _retry_interactive,
    ) -> list[list[float]]:
        async def call(batch: list[str]) -> list[list[float]]:
            # Inside the retried body on purpose: a retry is another request
            # against the same window, so it has to pay for a token too.
            await self._bucket.take(1)
            try:
                async with self._gate:
                    response = await self._client.aio.models.embed_content(
                        model=self._model,
                        contents=batch,
                        config=genai_types.EmbedContentConfig(
                            task_type=task_type,
                            output_dimensionality=self._dimensions,
                        ),
                    )
            except Exception as exc:  # noqa: BLE001 — SDK raises broad errors
                if _is_transient(exc):
                    raise _Retryable(str(exc), retry_after=_retry_after(exc)) from exc
                raise
            embeddings = response.embeddings or []
            return [_l2_normalize(list(e.values or [])) for e in embeddings]

        out: list[list[float]] = []
        for start in range(0, len(texts), _EMBED_BATCH):
            batch = texts[start : start + _EMBED_BATCH]
            try:
                vectors: list[list[float]] = await retrying(call, batch)
            except Exception as exc:
                log.warning("embedding_failed", batch_size=len(batch), error=str(exc))
                raise _classify(exc) from exc
            if len(vectors) != len(batch):
                raise UpstreamError("Embedding provider returned a mismatched batch")
            out.extend(vectors)
            if start + _EMBED_BATCH < len(texts):
                await asyncio.sleep(0.05)  # gentle pacing between batches
        return out

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return await self._embed(texts, "RETRIEVAL_DOCUMENT", _retry_background)

    async def embed_query(self, text: str) -> list[float]:
        vectors = await self._embed([text], "RETRIEVAL_QUERY")
        return vectors[0]


class GeminiLLM:
    def __init__(self, settings: Settings) -> None:
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.ai_generation_model

    @property
    def model(self) -> str:
        return self._model

    async def structured(
        self,
        *,
        system: str,
        prompt: str,
        schema: type[TModel],
        temperature: float = 0.4,
    ) -> TModel:
        async def call() -> Any:
            try:
                return await self._client.aio.models.generate_content(
                    model=self._model,
                    contents=prompt,
                    config=genai_types.GenerateContentConfig(
                        system_instruction=system,
                        temperature=temperature,
                        response_mime_type="application/json",
                        response_schema=schema,
                        # This service never passes tools, so the SDK's automatic
                        # function calling is dead weight — and it logs a two-line
                        # notice on every call. Turn it off explicitly.
                        automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(
                            disable=True
                        ),
                    ),
                )
            except Exception as exc:  # noqa: BLE001
                if _is_transient(exc):
                    raise _Retryable(str(exc), retry_after=_retry_after(exc)) from exc
                raise

        try:
            response: Any = await _retry_interactive(call)
        except Exception as exc:
            log.warning("generation_failed", model=self._model, error=str(exc))
            raise _classify(exc) from exc

        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, schema):
            return parsed

        # The SDK usually hands back a parsed object; fall back to the raw JSON
        # so a schema-shape mismatch surfaces as a clean 502 rather than a crash.
        raw = getattr(response, "text", None)
        if not raw:
            raise UpstreamError("The AI service returned an empty response.")
        try:
            return schema.model_validate_json(raw)
        except ValidationError as exc:
            log.warning("generation_schema_mismatch", error=str(exc))
            raise UpstreamError("The AI service returned an unusable response.") from exc
