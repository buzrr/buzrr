"""FastAPI application entrypoint."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from buzrr_ai import health
from buzrr_ai.api import documents, generation, spaces
from buzrr_ai.config import get_settings
from buzrr_ai.deps import close_queue
from buzrr_ai.errors import register_exception_handlers
from buzrr_ai.logging import configure_logging

log = structlog.get_logger(__name__)

# Everything sits under /api/ai. The Nest server owns /api/*, so this prefix
# keeps the two surfaces distinguishable if they are ever put behind one gateway.
API_PREFIX = "/api/ai"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    log.info(
        "starting",
        port=settings.ai_port,
        embedding_model=settings.ai_embedding_model,
        generation_model=settings.ai_generation_model,
    )
    yield
    await close_queue()
    log.info("stopped")


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.ai_log_level)

    app = FastAPI(
        title="Buzrr-AI",
        description="Knowledge Spaces, document ingestion and RAG quiz generation.",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,  # Bearer tokens only; no cookies cross this boundary.
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    register_exception_handlers(app)

    app.include_router(health.router)
    app.include_router(spaces.router, prefix=API_PREFIX)
    app.include_router(documents.router, prefix=API_PREFIX)
    app.include_router(generation.router, prefix=API_PREFIX)
    return app


app = create_app()
