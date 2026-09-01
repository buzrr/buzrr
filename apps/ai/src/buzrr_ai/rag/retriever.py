"""Retrieval: metadata prefilter → pgvector ANN → MMR diversification."""

import uuid
from dataclasses import dataclass

import structlog
from sqlalchemy import Float, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from buzrr_ai.config import Settings
from buzrr_ai.db.models import Chunk, Document
from buzrr_ai.providers.base import EmbeddingProvider
from buzrr_ai.rag.mmr import mmr_select

log = structlog.get_logger(__name__)


@dataclass(slots=True)
class RetrievedChunk:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    text: str
    page_start: int | None
    page_end: int | None
    heading_path: list[str]
    score: float


async def space_headings(db: AsyncSession, space_id: uuid.UUID) -> list[str]:
    """Distinct heading paths in a space — the planner's vocabulary."""
    stmt = select(Chunk.heading_path).where(Chunk.space_id == space_id).distinct().limit(400)
    seen: dict[str, None] = {}
    for (path,) in (await db.execute(stmt)).all():
        if path:
            seen.setdefault(" > ".join(path), None)
    return list(seen)


async def retrieve(
    db: AsyncSession,
    *,
    settings: Settings,
    embeddings: EmbeddingProvider,
    user_id: str,
    space_id: uuid.UUID,
    query: str,
    section_filter: list[str],
) -> list[RetrievedChunk]:
    query_vector = await embeddings.embed_query(query)

    candidates = await _ann_search(
        db,
        user_id=user_id,
        space_id=space_id,
        query_vector=query_vector,
        section_filter=section_filter,
        limit=settings.ai_retrieval_candidates,
    )

    # A section filter that matches nothing is far worse than no filter: the user
    # gets an empty result for a section that exists under a different spelling.
    # Fall back to unfiltered search rather than returning nothing.
    if not candidates and section_filter:
        log.info("retrieval_filter_empty_fallback", space_id=str(space_id), filter=section_filter)
        candidates = await _ann_search(
            db,
            user_id=user_id,
            space_id=space_id,
            query_vector=query_vector,
            section_filter=[],
            limit=settings.ai_retrieval_candidates,
        )

    if not candidates:
        return []

    vectors = [c[1] for c in candidates]
    keep = mmr_select(
        query=query_vector,
        candidates=vectors,
        k=settings.ai_retrieval_final,
        lambda_mult=settings.ai_mmr_lambda,
    )
    return [candidates[i][0] for i in keep]


async def _ann_search(
    db: AsyncSession,
    *,
    user_id: str,
    space_id: uuid.UUID,
    query_vector: list[float],
    section_filter: list[str],
    limit: int,
) -> list[tuple[RetrievedChunk, list[float]]]:
    """Vector search, always scoped to one tenant's one space.

    `user_id` is redundant next to `space_id` (a space is already owned) but is
    included as belt-and-braces: no query in this service reaches chunk text
    without both.
    """
    distance = Chunk.embedding.cosine_distance(query_vector)
    stmt = (
        select(
            Chunk.id,
            Chunk.document_id,
            Document.filename,
            Chunk.text,
            Chunk.page_start,
            Chunk.page_end,
            Chunk.heading_path,
            Chunk.embedding,
            distance.cast(Float).label("distance"),
        )
        .join(Document, Document.id == Chunk.document_id)
        .where(
            Chunk.space_id == space_id,
            Chunk.user_id == user_id,
            Document.status == "ready",
        )
    )

    for position, fragment in enumerate(section_filter):
        cleaned = fragment.strip()
        if not cleaned:
            continue
        # Match the fragment anywhere in the heading path. `array_to_string`
        # keeps this a single ILIKE rather than an unnest+exists per fragment.
        # The parameter is named by position: deriving it from the text can
        # collide ("Unit 4" / "Unit-4"), which silently drops one filter.
        name = f"frag_{position}"
        stmt = stmt.where(
            text(f"array_to_string(chunks.heading_path, ' > ') ILIKE :{name}")
        ).params(**{name: f"%{cleaned}%"})

    stmt = stmt.order_by(distance).limit(limit)

    rows = (await db.execute(stmt)).all()
    out: list[tuple[RetrievedChunk, list[float]]] = []
    for row in rows:
        out.append(
            (
                RetrievedChunk(
                    chunk_id=row.id,
                    document_id=row.document_id,
                    document_name=row.filename,
                    text=row.text,
                    page_start=row.page_start,
                    page_end=row.page_end,
                    heading_path=list(row.heading_path or []),
                    score=1.0 - float(row.distance),
                ),
                list(row.embedding),
            )
        )
    return out
