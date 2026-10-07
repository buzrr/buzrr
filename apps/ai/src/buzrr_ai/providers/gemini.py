"""Gemini implementations of the provider protocols (`google-genai` SDK)."""

import asyncio
from typing import Any, TypeVar

import structlog
from google import genai
from google.genai import types as genai_types
from pydantic import BaseModel, ValidationError
from tenacity import AsyncRetrying

from buzrr_ai.config import Settings
from buzrr_ai.errors import UpstreamError

# Shared with the other providers; re-exported here because tests (and any
# code written before the split) import them from this module.
from buzrr_ai.providers._resilience import (  # noqa: F401
    _classify,
    _is_rate_limited,
    _is_transient,
    _l2_normalize,
    _retry_after,
    _retry_background,
    _retry_interactive,
    _Retryable,
    _retrying,
    _TokenBucket,
    _wait,
)

log = structlog.get_logger(__name__)

TModel = TypeVar("TModel", bound=BaseModel)

# Gemini's embed_content takes a batch; keep requests well under the payload cap.
_EMBED_BATCH = 100


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
