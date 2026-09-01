"""Initial `ai` schema: spaces, documents, chunks, generation runs.

Revision ID: 0001_initial
Revises:
"""

from collections.abc import Sequence

import pgvector.sqlalchemy
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "ai"
EMBEDDING_DIM = 768


def upgrade() -> None:
    # `vector` is an untrusted extension: creating it needs superuser. A
    # schema-scoped migration role cannot, so the extension must be provisioned
    # separately (managed Postgres usually offers it as a one-click/DBA step) —
    # this statement then no-ops for the non-superuser role, because Postgres
    # short-circuits IF NOT EXISTS before the privilege check.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"')

    op.create_table(
        "knowledge_spaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(64), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "name", name="uq_space_user_name"),
        schema=SCHEMA,
    )
    op.create_index("ix_knowledge_spaces_user_id", "knowledge_spaces", ["user_id"], schema=SCHEMA)

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("space_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(64), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("extension", sa.String(16), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="queued"),
        sa.Column("error", sa.Text()),
        sa.Column("page_count", sa.Integer()),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(
            ["space_id"], [f"{SCHEMA}.knowledge_spaces.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint("space_id", "sha256", name="uq_document_space_sha"),
        sa.CheckConstraint(
            "status IN ('queued','processing','ready','failed')", name="ck_document_status"
        ),
        schema=SCHEMA,
    )
    op.create_index("ix_documents_space_status", "documents", ["space_id", "status"], schema=SCHEMA)

    op.create_table(
        "chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("space_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(64), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("page_start", sa.Integer()),
        sa.Column("page_end", sa.Integer()),
        sa.Column(
            "heading_path",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(EMBEDDING_DIM), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], [f"{SCHEMA}.documents.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("document_id", "ordinal", name="uq_chunk_document_ordinal"),
        schema=SCHEMA,
    )
    # Every retrieval query filters by space_id before ranking by distance, so
    # this btree is what keeps the ANN scan scoped to one tenant.
    op.create_index("ix_chunks_space", "chunks", ["space_id"], schema=SCHEMA)

    # HNSW over cosine distance. m=16 / ef_construction=64 are pgvector's
    # defaults and are appropriate up to ~1M vectors; raising them costs build
    # time and memory for recall this corpus doesn't need.
    op.execute(
        f"""
        CREATE INDEX ix_chunks_embedding_hnsw
        ON "{SCHEMA}".chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        """
    )

    # Reserved for the hybrid BM25 path (a later phase). Shipping the column now
    # means enabling it later needs no migration.
    op.execute(
        f"""
        ALTER TABLE "{SCHEMA}".chunks
        ADD COLUMN tsv tsvector
        GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
        """
    )
    op.execute(f'CREATE INDEX ix_chunks_tsv ON "{SCHEMA}".chunks USING gin (tsv)')

    op.create_table(
        "generation_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("space_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(64), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("plan", postgresql.JSONB()),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("error", sa.Text()),
        sa.Column("model", sa.String(120)),
        sa.Column("latency_ms", sa.Integer()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["space_id"], [f"{SCHEMA}.knowledge_spaces.id"], ondelete="CASCADE"
        ),
        sa.CheckConstraint("status IN ('pending','ready','failed')", name="ck_run_status"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_runs_space_created", "generation_runs", ["space_id", "created_at"], schema=SCHEMA
    )

    op.create_table(
        "generated_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(64), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("difficulty", sa.String(16)),
        sa.Column("stem", sa.Text(), nullable=False),
        sa.Column("options", postgresql.JSONB(), nullable=False),
        sa.Column("explanation", sa.Text()),
        sa.Column("discarded", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["run_id"], [f"{SCHEMA}.generation_runs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("run_id", "ordinal", name="uq_question_run_ordinal"),
        schema=SCHEMA,
    )

    op.create_table(
        "question_citations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_id", postgresql.UUID(as_uuid=True)),
        sa.Column("document_id", postgresql.UUID(as_uuid=True)),
        sa.Column("document_name", sa.String(500), nullable=False),
        sa.Column("page_start", sa.Integer()),
        sa.Column("page_end", sa.Integer()),
        sa.Column(
            "heading_path",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("rank", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["question_id"], [f"{SCHEMA}.generated_questions.id"], ondelete="CASCADE"
        ),
        # SET NULL, not CASCADE: re-ingesting a document replaces its chunks, and
        # that must not silently delete the citations of past runs.
        sa.ForeignKeyConstraint(["chunk_id"], [f"{SCHEMA}.chunks.id"], ondelete="SET NULL"),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_table("question_citations", schema=SCHEMA)
    op.drop_table("generated_questions", schema=SCHEMA)
    op.drop_table("generation_runs", schema=SCHEMA)
    op.drop_table("chunks", schema=SCHEMA)
    op.drop_table("documents", schema=SCHEMA)
    op.drop_table("knowledge_spaces", schema=SCHEMA)
    # The schema and extension are left in place: dropping them would be
    # destructive beyond this migration's scope.
