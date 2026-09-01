"""arq worker.

A separate process from the API — ingestion is CPU-heavy (PDF parsing) and must
never share an event loop with request handling.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from arq import Retry, cron

from buzrr_ai.config import get_settings
from buzrr_ai.db.repositories import documents as documents_repo
from buzrr_ai.db.session import SessionFactory
from buzrr_ai.deps import ARQ_QUEUE, get_embeddings, redis_settings
from buzrr_ai.errors import UpstreamRateLimited
from buzrr_ai.ingestion import storage
from buzrr_ai.ingestion.pipeline import ingest_document as run_ingestion
from buzrr_ai.logging import configure_logging

log = structlog.get_logger(__name__)

STALLED_AFTER = timedelta(minutes=30)
# Long enough for a per-minute provider quota to reset before we try again.
RATE_LIMIT_DEFER = timedelta(seconds=90)


async def ingest_document(ctx: dict[str, Any], document_id: str) -> int:
    """arq task. The name must stay in sync with the `enqueue_job` call in
    `api/documents.py` — arq addresses tasks by function name."""
    settings = get_settings()
    try:
        async with SessionFactory() as db:
            return await run_ingestion(
                db=db,
                settings=settings,
                embeddings=get_embeddings(),
                document_id=uuid.UUID(document_id),
            )
    except UpstreamRateLimited as exc:
        # The provider's quota is spent. A plain exception would end the job for
        # good (arq only re-delivers on `Retry`), leaving a fine document marked
        # failed, so ask for the job back once the window has had time to reset.
        # `pipeline` has already returned the row to `queued`.
        attempt = int(ctx.get("job_try", 1))
        if attempt >= WorkerSettings.max_tries:
            # Out of patience: say so on the document rather than leaving it
            # sitting in `queued` with no job behind it.
            async with SessionFactory() as db:
                await documents_repo.mark_failed(db, uuid.UUID(document_id), str(exc.detail))
            log.warning("ingest_rate_limited_exhausted", document_id=document_id)
            raise
        log.info("ingest_rate_limited_retry", document_id=document_id, attempt=attempt)
        raise Retry(defer=RATE_LIMIT_DEFER.total_seconds()) from exc


async def sweep_temp_files(_: dict[str, Any]) -> None:
    """Reap orphaned temp files and documents whose worker died mid-ingestion.

    Runs hourly rather than only at boot: a long-lived worker would otherwise
    accumulate the source files kept behind for failed documents.
    """
    settings = get_settings()
    removed = storage.sweep(settings.ai_tmp_dir)
    async with SessionFactory() as db:
        stalled = await documents_repo.reap_stalled(db, datetime.now(UTC) - STALLED_AFTER)
    if removed or stalled:
        log.info("sweep_complete", files_removed=removed, documents_failed=stalled)


async def startup(ctx: dict[str, Any]) -> None:
    settings = get_settings()
    configure_logging(settings.ai_log_level)
    log.info("worker_starting", queue=ARQ_QUEUE)
    await sweep_temp_files(ctx)


class WorkerSettings:
    functions = [ingest_document]  # noqa: RUF012
    # Two different mechanisms cover two different deployment shapes:
    #   - `on_startup` (below) runs `sweep_temp_files` once per process start —
    #     the only thing that matters when the worker is invoked as
    #     `arq --burst` on a schedule (e.g. a Render Cron Job, to avoid
    #     Background Workers having no free tier). arq's own `next_run` for a
    #     cron entry is always computed relative to *this process's* start
    #     time, so on a fresh short-lived process it's always in the future —
    #     it can never elapse before a burst exit. Verified against arq 0.28's
    #     Worker.main()/CronJob.next().
    #   - `cron_jobs` (this line) is what keeps the sweep running on a
    #     *long-lived* worker (Background Worker, or local
    #     `docker compose --profile ai up`), where `on_startup` only fires
    #     once at boot and this hourly recheck is what covers the following
    #     days of uptime. Redundant-but-harmless under `--burst`, load-bearing
    #     otherwise — keep both.
    cron_jobs = [cron(sweep_temp_files, minute=7)]  # type: ignore[arg-type]  # noqa: RUF012
    on_startup = startup
    queue_name = ARQ_QUEUE
    max_jobs = 4
    job_timeout = 900  # a 500-page PDF is slow; better a long timeout than a lost job
    # Each retry of a rate-limited ingest waits `RATE_LIMIT_DEFER`, so this is
    # roughly 4.5 minutes of patience before a document is called failed.
    max_tries = 4
    keep_result = 3600
    redis_settings = redis_settings(get_settings())
