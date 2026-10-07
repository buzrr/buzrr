"""Environment configuration.

Mirrors the repo convention of failing loudly at boot for anything the service
cannot run without (see `apps/server/src/redis/redis.module.ts`), rather than
discovering the gap on the first request.
"""

from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- required -----------------------------------------------------------
    ai_database_url: str
    redis_url: str
    better_auth_secret: str

    # CORS allow-list. Unlike the Nest server's `parse-cors-origin.ts`, an unset
    # value here fails closed — no reason to repeat that known debt in new code.
    ai_web_origin: str

    # Nest API origin (no /api suffix). AI generation tokens live in Nest's ledger
    # (`apps/server/src/modules/billing`), so each generation reserves one there
    # with the caller's own bearer token. Unreachable = generation fails closed.
    ai_buzrr_api_url: str

    # --- model provider -----------------------------------------------------
    # Which API embeddings and generation go to. Unset: Gemini, unless
    # LLM_BASE_URL points at an OpenAI-compatible server (Ollama, vLLM, …).
    llm_provider: Literal["gemini", "openai"] | None = None
    # Required for Gemini.
    gemini_api_key: str = ""
    # OpenAI-compatible base URL, e.g. http://localhost:11434/v1 (Ollama).
    llm_base_url: str = ""
    # Optional: most local servers don't check it.
    llm_api_key: str = ""

    # --- optional -----------------------------------------------------------
    ai_port: int = 3002
    ai_log_level: str = "INFO"
    ai_db_schema: str = "ai"

    ai_embedding_model: str = "gemini-embedding-001"
    ai_embedding_dimensions: int = 768
    ai_generation_model: str = "gemini-3.5-flash"

    # Outbound pacing for the embeddings endpoint, in requests per minute. One
    # batch of up to `_EMBED_BATCH` chunks costs one request, so this bounds how
    # often we call, not how much we send. Sized for a free-tier key; raise it
    # substantially on a paid one or ingestion will be needlessly slow.
    ai_embed_requests_per_minute: int = 5

    # Concurrent requests to the embeddings endpoint. 1 keeps ingestion inside a
    # free-tier per-minute quota even when arq is running several jobs at once.
    ai_embed_max_concurrency: int = 1

    ai_max_upload_mb: int = 5
    ai_max_files: int = 10
    ai_tmp_dir: str = "/tmp/buzrr-ai"  # noqa: S108 — ephemeral container disk, by design

    # Chunking. `gemini-embedding-001` caps input at 2048 tokens per embedding,
    # so `chunk_max_tokens` must stay strictly below it.
    ai_chunk_target_tokens: int = 800
    ai_chunk_max_tokens: int = 1800
    ai_chunk_overlap_tokens: int = 120

    # Retrieval.
    ai_retrieval_candidates: int = 40
    ai_retrieval_final: int = 12
    ai_mmr_lambda: float = 0.6

    # Per-user rate limits (sliding windows, backed by the shared Redis).
    ai_rate_uploads_per_hour: int = 40
    ai_rate_generations_per_hour: int = 30

    @property
    def provider(self) -> Literal["gemini", "openai"]:
        if self.llm_provider:
            return self.llm_provider
        return "openai" if self.llm_base_url else "gemini"

    @model_validator(mode="after")
    def _provider_is_usable(self) -> "Settings":
        if self.provider == "gemini" and not self.gemini_api_key:
            raise ValueError(
                "GEMINI_API_KEY is required, or set LLM_BASE_URL to an "
                "OpenAI-compatible server (e.g. Ollama) instead"
            )
        if self.provider == "openai" and not self.llm_base_url:
            raise ValueError("LLM_BASE_URL is required when LLM_PROVIDER=openai")
        return self

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ai_web_origin.split(",") if o.strip()]

    @field_validator("ai_embedding_dimensions")
    @classmethod
    def _matches_column_width(cls, v: int) -> int:
        # `chunks.embedding` is `Vector(EMBEDDING_DIM)` and the migration creates
        # that fixed width, so any other value here boots fine and then fails on
        # every chunk insert inside the worker. Fail at boot instead.
        # Imported locally: `db.models` pulls SQLAlchemy, which this module
        # (loaded by everything, including Alembic's env) has no other need for.
        from buzrr_ai.db.models import EMBEDDING_DIM

        if v != EMBEDDING_DIM:
            raise ValueError(
                f"ai_embedding_dimensions must be {EMBEDDING_DIM} to match the "
                "chunks.embedding column width; changing it needs a migration"
            )
        return v

    @field_validator("ai_chunk_max_tokens")
    @classmethod
    def _under_embedding_input_cap(cls, v: int) -> int:
        if v >= 2048:
            raise ValueError("ai_chunk_max_tokens must be < 2048 (gemini-embedding-001 input cap)")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
