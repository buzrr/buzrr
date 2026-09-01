"""Document + chunk persistence."""

import uuid
from datetime import UTC, datetime
from typing import Any, cast

from sqlalchemy import CursorResult, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from buzrr_ai.db.models import Chunk, Document
from buzrr_ai.errors import NotFound


async def list_documents(db: AsyncSession, user_id: str, space_id: uuid.UUID) -> list[Document]:
    stmt = (
        select(Document)
        .where(Document.space_id == space_id, Document.user_id == user_id)
        .order_by(Document.created_at.asc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_document(db: AsyncSession, user_id: str, document_id: uuid.UUID) -> Document:
    stmt = select(Document).where(Document.id == document_id, Document.user_id == user_id)
    doc = (await db.execute(stmt)).scalar_one_or_none()
    if doc is None:
        raise NotFound("Unauthorized or document not found")
    return doc


async def find_by_hash(db: AsyncSession, space_id: uuid.UUID, sha256: str) -> Document | None:
    stmt = select(Document).where(Document.space_id == space_id, Document.sha256 == sha256)
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_document(
    db: AsyncSession,
    *,
    user_id: str,
    space_id: uuid.UUID,
    filename: str,
    extension: str,
    size_bytes: int,
    sha256: str,
) -> Document:
    doc = Document(
        user_id=user_id,
        space_id=space_id,
        filename=filename,
        extension=extension,
        size_bytes=size_bytes,
        sha256=sha256,
        status="queued",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def mark_processing(db: AsyncSession, document_id: uuid.UUID) -> bool:
    """Claim a queued/failed document. Returns False if someone else already has it.

    The `status IN ('queued','failed')` predicate is the whole point: arq can
    deliver a job more than once, and two workers must not index the same
    document twice.
    """
    stmt = (
        update(Document)
        .where(Document.id == document_id, Document.status.in_(("queued", "failed")))
        .values(
            status="processing",
            started_at=datetime.now(UTC),
            error=None,
            attempts=Document.attempts + 1,
        )
    )
    result = cast(CursorResult[Any], await db.execute(stmt))
    await db.commit()
    return result.rowcount > 0


async def mark_queued(db: AsyncSession, document_id: uuid.UUID) -> None:
    """Put a document back in line without blaming it.

    Used when ingestion is interrupted by something that has nothing to do with
    the document itself — a provider quota blip — so the worker can defer the
    job and come back to it. `attempts` is left as-is: `mark_processing` already
    counted this pass.
    """
    await db.execute(
        update(Document)
        .where(Document.id == document_id)
        .values(status="queued", error=None, started_at=None)
    )
    await db.commit()


async def mark_failed(db: AsyncSession, document_id: uuid.UUID, error: str) -> None:
    await db.execute(
        update(Document)
        .where(Document.id == document_id)
        .values(status="failed", error=error[:2000], processed_at=datetime.now(UTC))
    )
    await db.commit()


async def replace_chunks(
    db: AsyncSession,
    *,
    document: Document,
    chunks: list[Chunk],
    page_count: int | None,
) -> None:
    """Swap a document's chunks and flip it to ready, in one transaction.

    Delete-then-insert (rather than append) is what makes a retry idempotent —
    re-running ingestion for a document can never double-index it.
    """
    await db.execute(delete(Chunk).where(Chunk.document_id == document.id))
    db.add_all(chunks)
    await db.execute(
        update(Document)
        .where(Document.id == document.id)
        .values(
            status="ready",
            error=None,
            chunk_count=len(chunks),
            page_count=page_count,
            processed_at=datetime.now(UTC),
        )
    )
    await db.commit()


async def delete_document(db: AsyncSession, user_id: str, document_id: uuid.UUID) -> None:
    doc = await get_document(db, user_id, document_id)
    await db.execute(delete(Document).where(Document.id == doc.id))
    await db.commit()


async def status_counts(db: AsyncSession, space_id: uuid.UUID) -> dict[str, int]:
    stmt = (
        select(Document.status, func.count(Document.id))
        .where(Document.space_id == space_id)
        .group_by(Document.status)
    )
    counts = {"queued": 0, "processing": 0, "ready": 0, "failed": 0}
    for status, count in (await db.execute(stmt)).all():
        counts[status] = int(count)
    return counts


async def reap_stalled(db: AsyncSession, older_than: datetime) -> int:
    """Fail documents stuck in `processing` — the worker that owned them died.

    Mirrors the repo's "recovery is a first-class path" stance (invariant #10)
    without needing a distributed lock: the sweep is idempotent and a failed
    document is retryable.
    """
    stmt = (
        update(Document)
        .where(Document.status == "processing", Document.started_at < older_than)
        .values(
            status="failed",
            error="Processing did not finish (worker restarted). Retry the document.",
            processed_at=datetime.now(UTC),
        )
    )
    result = cast(CursorResult[Any], await db.execute(stmt))
    await db.commit()
    return int(result.rowcount)
