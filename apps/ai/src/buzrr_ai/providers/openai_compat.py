"""OpenAI-compatible implementations of the provider protocols (plain HTTP).

Speaks the `/chat/completions` and `/embeddings` endpoints that OpenAI defined
and most model servers copy: Ollama (`http://localhost:11434/v1`), vLLM, LM
Studio, llama.cpp's server, LiteLLM, OpenRouter, Gemini's OpenAI endpoint.
That is what lets a self-hosted install run Knowledge Spaces on a model in the
same building, with no Gemini key and no internet.
"""

import asyncio
import json
import re
from typing import Any, TypeVar

import httpx
import structlog
from pydantic import BaseModel, ValidationError

from buzrr_ai.config import Settings
from buzrr_ai.errors import UpstreamError
from buzrr_ai.providers._resilience import (
    _classify,
    _l2_normalize,
    _retry_background,
    _retry_interactive,
    _Retryable,
    _TokenBucket,
)

log = structlog.get_logger(__name__)

TModel = TypeVar("TModel", bound=BaseModel)

# Local servers handle smaller batches more gracefully than hosted APIs.
_EMBED_BATCH = 64
_TIMEOUT = httpx.Timeout(120.0, connect=10.0)
_RETRY_STATUSES = {408, 409, 429, 500, 502, 503, 504}
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def _headers(api_key: str) -> dict[str, str]:
    # Ollama and most local servers ignore auth; sending none is the norm there.
    return {"Authorization": f"Bearer {api_key}"} if api_key else {}


async def _post(client: httpx.AsyncClient, path: str, body: dict[str, Any], api_key: str) -> Any:
    try:
        response = await client.post(path, json=body, headers=_headers(api_key))
    except httpx.TimeoutException as exc:
        raise _Retryable(f"timeout: {exc}") from exc
    except httpx.TransportError as exc:
        raise _Retryable(f"503 unavailable: {exc}") from exc
    if response.status_code in _RETRY_STATUSES:
        retry_after = response.headers.get("retry-after")
        raise _Retryable(
            f"{response.status_code}: {response.text[:200]}",
            retry_after=float(retry_after) if retry_after and retry_after.isdigit() else None,
        )
    if response.status_code >= 400:
        raise UpstreamError(f"Model server returned {response.status_code}")
    return response.json()


class OpenAICompatEmbeddings:
    def __init__(
        self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.llm_base_url.rstrip("/") + "/",
            timeout=_TIMEOUT,
            transport=transport,
        )
        self._api_key = settings.llm_api_key
        self._model = settings.ai_embedding_model
        self._dimensions = settings.ai_embedding_dimensions
        self._gate = asyncio.Semaphore(max(1, settings.ai_embed_max_concurrency))
        self._bucket = _TokenBucket(settings.ai_embed_requests_per_minute)

    @property
    def model(self) -> str:
        return self._model

    @property
    def dimensions(self) -> int:
        return self._dimensions

    async def _embed(self, texts: list[str], retrying: Any) -> list[list[float]]:
        async def call(batch: list[str]) -> list[list[float]]:
            await self._bucket.take(1)
            async with self._gate:
                body = await _post(
                    self._client,
                    "embeddings",
                    # `dimensions` lets MRL models (text-embedding-3-*) shorten
                    # to the column width; servers without it ignore the field.
                    {"model": self._model, "input": batch, "dimensions": self._dimensions},
                    self._api_key,
                )
            data = sorted(body.get("data") or [], key=lambda d: d.get("index", 0))
            return [list(d.get("embedding") or []) for d in data]

        out: list[list[float]] = []
        for start in range(0, len(texts), _EMBED_BATCH):
            batch = texts[start : start + _EMBED_BATCH]
            try:
                vectors: list[list[float]] = await retrying(call, batch)
            except UpstreamError:
                raise
            except Exception as exc:
                log.warning("embedding_failed", batch_size=len(batch), error=str(exc))
                raise _classify(exc) from exc
            if len(vectors) != len(batch):
                raise UpstreamError("Embedding provider returned a mismatched batch")
            for vector in vectors:
                if len(vector) != self._dimensions:
                    # The `chunks.embedding` column is fixed-width; storing a
                    # different width fails every insert, so say why up front.
                    raise UpstreamError(
                        f"Embedding model {self._model!r} returned {len(vector)} dimensions; "
                        f"Knowledge Spaces need {self._dimensions}. Use a "
                        f"{self._dimensions}-dimension model (e.g. nomic-embed-text) or one "
                        "that honours the `dimensions` parameter."
                    )
            out.extend(_l2_normalize(v) for v in vectors)
        return out

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return await self._embed(texts, _retry_background)

    async def embed_query(self, text: str) -> list[float]:
        # OpenAI-style embeddings are symmetric — no query/document task type.
        return (await self._embed([text], _retry_interactive))[0]


class OpenAICompatLLM:
    def __init__(
        self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.llm_base_url.rstrip("/") + "/",
            timeout=_TIMEOUT,
            transport=transport,
        )
        self._api_key = settings.llm_api_key
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
        json_schema = schema.model_json_schema()
        body = {
            "model": self._model,
            "temperature": temperature,
            "messages": [
                # The schema goes in the prompt too: servers that ignore
                # `response_format` still get told what shape to produce.
                {
                    "role": "system",
                    "content": f"{system}\n\nRespond with JSON only, matching this JSON "
                    f"Schema:\n{json.dumps(json_schema)}",
                },
                {"role": "user", "content": prompt},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": schema.__name__, "schema": json_schema},
            },
        }

        async def call() -> Any:
            return await _post(self._client, "chat/completions", body, self._api_key)

        try:
            response: Any = await _retry_interactive(call)
        except UpstreamError:
            raise
        except Exception as exc:
            log.warning("generation_failed", model=self._model, error=str(exc))
            raise _classify(exc) from exc

        try:
            raw = response["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as exc:
            raise UpstreamError("The AI service returned an empty response.") from exc
        raw = _FENCE.sub("", raw.strip())
        if not raw:
            raise UpstreamError("The AI service returned an empty response.")
        try:
            return schema.model_validate_json(raw)
        except ValidationError as exc:
            log.warning("generation_schema_mismatch", error=str(exc))
            raise UpstreamError("The AI service returned an unusable response.") from exc
