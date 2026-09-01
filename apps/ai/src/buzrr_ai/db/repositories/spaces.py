"""Knowledge Space queries.

Tenant isolation rule: **every** function takes `user_id` and folds it into the
WHERE clause. Nothing in this module can be called without a tenant. Missing and
not-yours both surface as `NotFound`, matching how the Nest services deliberately
answer `NotFoundException("Unauthorized or ...")` so ownership never leaks.
"""

import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from buzrr_ai.db.models import Chunk, Document, KnowledgeSpace
from buzrr_ai.errors import BadRequest, NotFound


async def list_spaces(db: AsyncSession, user_id: str) -> list[tuple[KnowledgeSpace, int, int]]:
    """Spaces with (document count, ready count) so the dashboard needs one call."""
    total = func.count(Document.id)
    ready = func.count(Document.id).filter(Document.status == "ready")
    stmt = (
        select(KnowledgeSpace, total, ready)
        .outerjoin(Document, Document.space_id == KnowledgeSpace.id)
        .where(KnowledgeSpace.user_id == user_id)
        .group_by(KnowledgeSpace.id)
        .order_by(KnowledgeSpace.created_at.desc())
    )
    rows = await db.execute(stmt)
    return [(s, int(t), int(r)) for s, t, r in rows.all()]


async def get_space(db: AsyncSession, user_id: str, space_id: uuid.UUID) -> KnowledgeSpace:
    stmt = select(KnowledgeSpace).where(
        KnowledgeSpace.id == space_id, KnowledgeSpace.user_id == user_id
    )
    space = (await db.execute(stmt)).scalar_one_or_none()
    if space is None:
        raise NotFound("Unauthorized or knowledge space not found")
    return space


async def create_space(
    db: AsyncSession, user_id: str, name: str, description: str | None
) -> KnowledgeSpace:
    space = KnowledgeSpace(user_id=user_id, name=name, description=description)
    db.add(space)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise BadRequest("You already have a knowledge space with that name") from exc
    await db.refresh(space)
    return space


async def update_space(
    db: AsyncSession,
    user_id: str,
    space_id: uuid.UUID,
    *,
    name: str | None,
    description: str | None,
) -> KnowledgeSpace:
    space = await get_space(db, user_id, space_id)
    if name is not None:
        space.name = name
    if description is not None:
        space.description = description
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise BadRequest("You already have a knowledge space with that name") from exc
    await db.refresh(space)
    return space


async def delete_space(db: AsyncSession, user_id: str, space_id: uuid.UUID) -> None:
    await get_space(db, user_id, space_id)
    await db.execute(delete(KnowledgeSpace).where(KnowledgeSpace.id == space_id))
    await db.commit()


async def space_chunk_count(db: AsyncSession, space_id: uuid.UUID) -> int:
    stmt = select(func.count(Chunk.id)).where(Chunk.space_id == space_id)
    return int((await db.execute(stmt)).scalar_one())
