"""Health probe.

Shape matches the Nest server's `GET /health` exactly
(`apps/server/src/modules/health/health.controller.ts`) — same keys, same 200/503
semantics — so one uptime check template covers both services.
"""

import time

import structlog
from arq.connections import ArqRedis
from fastapi import APIRouter, Response
from sqlalchemy import text

from buzrr_ai.db.session import SessionFactory
from buzrr_ai.deps import open_queue

log = structlog.get_logger(__name__)
router = APIRouter()

_BOOTED_AT = time.time()
_TIMEOUT_SECONDS = 2.0


async def _check_database() -> str:
    try:
        async with SessionFactory() as session:
            await session.execute(text("SELECT 1"))
        return "up"
    except Exception as exc:  # noqa: BLE001
        log.warning("health_database_down", error=str(exc))
        return "down"


async def _check_redis() -> str:
    try:
        pool: ArqRedis = await open_queue()
        await pool.ping()
        return "up"
    except Exception as exc:  # noqa: BLE001
        log.warning("health_redis_down", error=str(exc))
        return "down"


@router.get("/health", include_in_schema=False)
async def health(response: Response) -> dict[str, object]:
    import asyncio

    database, redis = await asyncio.gather(
        asyncio.wait_for(_check_database(), _TIMEOUT_SECONDS),
        asyncio.wait_for(_check_redis(), _TIMEOUT_SECONDS),
        return_exceptions=False,
    )

    healthy = database == "up" and redis == "up"
    response.status_code = 200 if healthy else 503
    return {
        "status": "ok" if healthy else "error",
        "uptime": round(time.time() - _BOOTED_AT, 3),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "services": {"database": database, "redis": redis},
    }
