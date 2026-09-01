"""Integration fixtures.

These need a real Postgres with pgvector — the vector column, the HNSW index and
the `heading_path` array filter cannot be faked. Locally that's the repo's
`docker compose up -d postgres` (now `pgvector/pgvector:pg16`); in CI it's the
service container.

If no database is reachable the whole module skips rather than failing, so
`pytest` stays useful on a machine without Docker running.

Setup is destructive — it drops and recreates the `ai` schema — so it runs
against a dedicated `<database>_test`, never against `AI_DATABASE_URL` itself.
"""

import asyncio
import os
import uuid
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

if TYPE_CHECKING:
    from tests.fakes import FakeLLM

from buzrr_ai.db.models import SCHEMA, Base
from buzrr_ai.db.session import to_asyncpg_url


def _resolve_test_url() -> str:
    """Pick a database this suite is allowed to *destroy*.

    Setup drops and recreates every table in the `ai` schema, so pointing it at
    `AI_DATABASE_URL` deletes whatever you have been working on locally — which
    is exactly what used to happen, since that was the fallback. Now the default
    is a sibling `<database>_test`, created on demand; sharing a database with
    the app requires saying so explicitly through `AI_TEST_DATABASE_URL`.
    """
    explicit = os.environ.get("AI_TEST_DATABASE_URL")
    if explicit:
        return to_asyncpg_url(explicit)
    url = make_url(to_asyncpg_url(os.environ["AI_DATABASE_URL"]))
    # `str(URL)` masks the password as "***"; this needs the real thing.
    return url.set(database=f"{url.database}_test").render_as_string(hide_password=False)


DATABASE_URL = _resolve_test_url()


async def _ensure_database() -> str | None:
    """Create the test database if it isn't there. Returns a skip reason on failure."""
    from sqlalchemy import text

    url = make_url(DATABASE_URL)
    # CREATE DATABASE cannot run inside a transaction, hence AUTOCOMMIT, and it
    # has to be issued from a connection to some *other* database.
    admin = create_async_engine(
        url.set(database="postgres").render_as_string(hide_password=False),
        poolclass=NullPool,
        isolation_level="AUTOCOMMIT",
    )
    try:
        async with admin.connect() as conn:
            exists = await conn.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": url.database}
            )
            if not exists:
                await conn.execute(text(f'CREATE DATABASE "{url.database}"'))
        return None
    except Exception as exc:  # noqa: BLE001 — any failure here is a skip, not an error
        return f"could not prepare the test database {url.database!r}: {exc}"
    finally:
        await admin.dispose()


async def _probe() -> bool:
    from sqlalchemy import text

    engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
    finally:
        await engine.dispose()


async def _create_schema() -> str | None:
    """Returns None on success, or a reason to skip."""
    from sqlalchemy import text

    engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
    try:
        async with engine.begin() as conn:
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            except Exception:
                return "pgvector unavailable — use the pgvector/pgvector image"
            await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"'))
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        return None
    finally:
        await engine.dispose()


@pytest.fixture(scope="session")
def database() -> str:
    """Prepare the `ai` schema once.

    Deliberately a *sync* fixture driving `asyncio.run`: asyncpg connections are
    bound to the loop that created them, and pytest-asyncio gives each test its
    own loop. Doing setup in a self-contained loop keeps no connection alive
    across that boundary.
    """
    if reason := asyncio.run(_ensure_database()):
        pytest.skip(reason)
    if not asyncio.run(_probe()):
        pytest.skip("No Postgres reachable — run `docker compose up -d postgres`")
    if reason := asyncio.run(_create_schema()):
        pytest.skip(reason)
    return DATABASE_URL


@pytest_asyncio.fixture
async def engine(database: str) -> AsyncIterator[AsyncEngine]:
    """A fresh engine per test, on that test's own event loop.

    NullPool because a pooled connection would outlive the loop it was opened on.
    """
    eng = create_async_engine(database, poolclass=NullPool)
    try:
        yield eng
    finally:
        await eng.dispose()


@pytest_asyncio.fixture
async def clean_tables(engine: AsyncEngine) -> AsyncIterator[None]:
    """Truncate between tests so ordering never matters."""
    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.execute(
            text(
                f'TRUNCATE "{SCHEMA}".knowledge_spaces, "{SCHEMA}".generation_runs '
                "RESTART IDENTITY CASCADE"
            )
        )
    yield


@pytest_asyncio.fixture
async def db(engine: AsyncEngine, clean_tables: None) -> AsyncIterator[AsyncSession]:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session


class StubPipeline:
    async def __aenter__(self) -> "StubPipeline":
        return self

    async def __aexit__(self, *_: object) -> None:
        return None

    def zremrangebyscore(self, *_: object, **__: object) -> None: ...
    def zcard(self, *_: object, **__: object) -> None: ...
    def zadd(self, *_: object, **__: object) -> None: ...
    def expire(self, *_: object, **__: object) -> None: ...

    async def execute(self) -> list[int]:
        return [0, 0, 0, 0]  # never rate-limited in tests


class StubQueue:
    """Records enqueued jobs instead of touching Redis."""

    def __init__(self) -> None:
        self.jobs: list[tuple[str, tuple[object, ...]]] = []

    async def enqueue_job(self, name: str, *args: object) -> None:
        self.jobs.append((name, args))

    def pipeline(self, transaction: bool = True) -> StubPipeline:
        return StubPipeline()

    async def ping(self) -> bool:
        return True


@pytest_asyncio.fixture
async def stub_queue() -> StubQueue:
    return StubQueue()


@pytest_asyncio.fixture
async def fake_llm() -> "FakeLLM":
    from tests.fakes import FakeLLM

    return FakeLLM()


@pytest_asyncio.fixture
async def client(
    engine: AsyncEngine, clean_tables: None, stub_queue: StubQueue, fake_llm: "FakeLLM"
) -> AsyncIterator[AsyncClient]:
    """The real app, wired to the test DB with both providers faked."""
    from buzrr_ai.db.session import get_session
    from buzrr_ai.deps import get_embeddings, get_llm, get_queue
    from buzrr_ai.main import create_app
    from tests.fakes import FakeEmbeddings

    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_queue] = lambda: stub_queue
    app.dependency_overrides[get_embeddings] = lambda: FakeEmbeddings()
    app.dependency_overrides[get_llm] = lambda: fake_llm

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as http:
        yield http


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def new_id() -> str:
    return str(uuid.uuid4())
