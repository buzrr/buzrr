"""The ingestion pipeline: parse → clean → chunk → embed → persist → delete.

Runs inside an arq worker, detached from any request. Every step is written so
that running it twice is harmless: the document is claimed with a conditional
UPDATE, and chunks are replaced rather than appended.
"""

import uuid
from pathlib import Path

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from buzrr_ai.config import Settings
from buzrr_ai.db.models import Chunk, Document
from buzrr_ai.db.repositories import documents as documents_repo
from buzrr_ai.errors import UpstreamRateLimited
from buzrr_ai.ingestion import storage
from buzrr_ai.ingestion.chunker import chunk_blocks
from buzrr_ai.ingestion.cleaner import clean_blocks
from buzrr_ai.ingestion.parsers import parse
from buzrr_ai.providers.base import EmbeddingProvider

log = structlog.get_logger(__name__)


class EmptyDocument(Exception):
    def __init__(self) -> None:
        super().__init__(
            "No readable text found. Scanned images need OCR, which isn't supported yet."
        )


async def ingest_document(
    *,
    db: AsyncSession,
    settings: Settings,
    embeddings: EmbeddingProvider,
    document_id: uuid.UUID,
) -> int:
    """Process one document. Returns the number of chunks indexed.

    Returns 0 without doing work if another worker already claimed the document
    — arq can deliver a job more than once and two workers must not both index it.
    """
    claimed = await documents_repo.mark_processing(db, document_id)
    if not claimed:
        log.info("ingest_skipped_not_claimable", document_id=str(document_id))
        return 0

    document = await db.get(Document, document_id)
    if document is None:  # deleted between enqueue and pickup
        return 0

    path = storage.temp_path(settings.ai_tmp_dir, document_id, document.extension)
    binder = log.bind(document_id=str(document_id), filename=document.filename)

    try:
        if not path.exists():
            raise FileNotFoundError(
                "The uploaded file is no longer available. Please upload it again."
            )

        parsed = parse(path, document.extension)
        cleaned = clean_blocks(parsed.blocks, page_count=parsed.page_count)
        if not cleaned:
            raise EmptyDocument()

        text_chunks = chunk_blocks(
            cleaned,
            target_tokens=settings.ai_chunk_target_tokens,
            max_tokens=settings.ai_chunk_max_tokens,
            overlap_tokens=settings.ai_chunk_overlap_tokens,
        )
        if not text_chunks:
            raise EmptyDocument()

        binder.info("ingest_chunked", chunks=len(text_chunks), pages=parsed.page_count)

        vectors = await embeddings.embed_documents([c.text for c in text_chunks])
        if len(vectors) != len(text_chunks):
            raise RuntimeError("Embedding count did not match chunk count")

        rows = [
            Chunk(
                document_id=document.id,
                space_id=document.space_id,
                user_id=document.user_id,
                ordinal=index,
                text=chunk.text,
                token_count=chunk.token_count,
                page_start=chunk.page_start,
                page_end=chunk.page_end,
                heading_path=chunk.heading_path,
                embedding=vector,
            )
            for index, (chunk, vector) in enumerate(zip(text_chunks, vectors, strict=True))
        ]

        await documents_repo.replace_chunks(
            db, document=document, chunks=rows, page_count=parsed.page_count
        )

        # Success: the source file has served its purpose and goes now. This is
        # the guarantee the feature makes to users — we keep the derived chunks,
        # never the document they came from.
        storage.discard(path)
        binder.info("ingest_ready", chunks=len(rows))
        return len(rows)

    except UpstreamRateLimited:
        # Nothing is wrong with this document — the provider's quota is simply
        # spent. Marking it `failed` here would strand a perfectly good file
        # behind a manual retry, so put it back in the queue and let the worker
        # defer the job instead.
        binder.info("ingest_deferred_rate_limited")
        await documents_repo.mark_queued(db, document_id)
        raise

    except Exception as exc:
        message = _user_message(exc)
        binder.warning("ingest_failed", error=str(exc))
        await documents_repo.mark_failed(db, document_id, message)
        # Deliberately NOT deleting the temp file here: retry would then have
        # nothing to re-parse and the user would have to re-upload. The periodic
        # `sweep_temp_files` cron reaps it after 6h, so this cannot leak
        # unboundedly.
        raise


def _user_message(exc: Exception) -> str:
    """Something a user can act on — never a raw traceback."""
    if isinstance(exc, EmptyDocument | FileNotFoundError):
        return str(exc)
    from buzrr_ai.errors import AppError

    if isinstance(exc, AppError):
        detail = exc.detail
        return detail if isinstance(detail, str) else "Processing failed."
    return "Processing failed. Try re-uploading this document."


def resolve_extension(filename: str) -> str:
    return Path(filename).suffix.lower()
