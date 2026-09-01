"""Shared FastAPI dependencies."""

from functools import lru_cache
from typing import Annotated

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings
from fastapi import Depends

from buzrr_ai.config import Settings, get_settings
from buzrr_ai.providers.base import EmbeddingProvider, LLMProvider
from buzrr_ai.providers.gemini import GeminiEmbeddings, GeminiLLM

SettingsDep = Annotated[Settings, Depends(get_settings)]

# arq namespaces its own keys under this prefix so nothing can collide with the
# game engine's `game:*` / `games:deadlines` / `mm:duel:*` / `duel:invite:*`
# keyspaces (docs/architecture/data.md).
ARQ_QUEUE = "ai:arq:queue"


def redis_settings(settings: Settings) -> RedisSettings:
    return RedisSettings.from_dsn(settings.redis_url)


@lru_cache
def get_embeddings() -> EmbeddingProvider:
    return GeminiEmbeddings(get_settings())


@lru_cache
def get_llm() -> LLMProvider:
    return GeminiLLM(get_settings())


EmbeddingsDep = Annotated[EmbeddingProvider, Depends(get_embeddings)]
LLMDep = Annotated[LLMProvider, Depends(get_llm)]

_pool: ArqRedis | None = None


async def open_queue() -> ArqRedis:
    global _pool
    if _pool is None:
        _pool = await create_pool(redis_settings(get_settings()), default_queue_name=ARQ_QUEUE)
    return _pool


async def close_queue() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def get_queue() -> ArqRedis:
    return await open_queue()


QueueDep = Annotated[ArqRedis, Depends(get_queue)]
