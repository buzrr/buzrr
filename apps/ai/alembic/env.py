"""Alembic environment.

Ownership boundary (ADR-009): this configuration is confined to the `ai` schema
by `include_object` + `include_schemas`. Alembic must never emit DDL for a table
Prisma owns, and autogenerate must never see `public` as "extra tables to drop".
"""

import asyncio
from logging.config import fileConfig

import sqlalchemy as sa
from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from buzrr_ai.config import get_settings
from buzrr_ai.db.models import SCHEMA, Base
from buzrr_ai.db.session import to_asyncpg_url

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
config.set_main_option("sqlalchemy.url", to_asyncpg_url(get_settings().ai_database_url))


def include_object(_object, _name, type_, _reflected, _compare_to) -> bool:
    if type_ == "table":
        return _object.schema == SCHEMA
    return True


def _configure(connection=None, url=None) -> None:
    context.configure(
        connection=connection,
        url=url,
        target_metadata=target_metadata,
        include_schemas=True,
        include_object=include_object,
        version_table="alembic_version",
        version_table_schema=SCHEMA,
        compare_type=True,
    )


def run_migrations_offline() -> None:
    _configure(url=config.get_main_option("sqlalchemy.url"))
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    # Alembic puts its own `alembic_version` table inside the `ai` schema, so the
    # schema has to exist before the first migration runs — it cannot be created
    # by that migration. Idempotent, and the only DDL env.py is allowed to emit.
    connection.execute(sa.text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"'))
    connection.commit()
    _configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_async_migrations())
