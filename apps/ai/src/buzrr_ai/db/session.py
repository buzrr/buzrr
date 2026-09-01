"""Async engine + session factory.

Points at the same Postgres instance Prisma uses, through a role scoped to the
`ai` schema in production. `DATABASE_URL` values in this repo are written in the
`postgresql://` form the Prisma pg adapter wants; asyncpg needs the
`postgresql+asyncpg://` driver prefix, so normalise it here rather than asking
every deployment to keep a second spelling in sync.
"""

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from buzrr_ai.config import get_settings


def to_asyncpg_url(url: str) -> str:
    if url.startswith("postgresql+"):
        return url
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


_settings = get_settings()

engine = create_async_engine(
    to_asyncpg_url(_settings.ai_database_url),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
)

SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_session)]
