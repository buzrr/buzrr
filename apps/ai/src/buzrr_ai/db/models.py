"""SQLAlchemy models for the `ai` schema.

Ownership boundary (see ADR-009): Alembic owns everything in the `ai` schema and
never touches `public`; Prisma owns `public` and never touches `ai`. There are
deliberately **no foreign keys into `public.users`** — `user_id` is a plain text
column populated from the JWT `sub`, so the two migration tools stay independent.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

SCHEMA = "ai"
EMBEDDING_DIM = 768


class Base(DeclarativeBase):
    metadata = MetaData(schema=SCHEMA)


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class KnowledgeSpace(Base):
    __tablename__ = "knowledge_spaces"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    documents: Mapped[list[Document]] = relationship(
        back_populates="space", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_space_user_name"),)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = _uuid_pk()
    space_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.knowledge_spaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    extension: Mapped[str] = mapped_column(String(16), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)

    # queued | processing | ready | failed
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    error: Mapped[str | None] = mapped_column(Text)
    page_count: Mapped[int | None] = mapped_column(Integer)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    space: Mapped[KnowledgeSpace] = relationship(back_populates="documents")
    chunks: Mapped[list[Chunk]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # Re-uploading the same bytes into the same space is a no-op, not a
        # second copy of every chunk.
        UniqueConstraint("space_id", "sha256", name="uq_document_space_sha"),
        CheckConstraint(
            "status IN ('queued','processing','ready','failed')", name="ck_document_status"
        ),
        Index("ix_documents_space_status", "space_id", "status"),
    )


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[uuid.UUID] = _uuid_pk()
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.documents.id", ondelete="CASCADE"), nullable=False
    )
    # Denormalised so every retrieval query can filter by tenant without a join.
    space_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False)

    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False)
    page_start: Mapped[int | None] = mapped_column(Integer)
    page_end: Mapped[int | None] = mapped_column(Integer)
    heading_path: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM), nullable=False)

    document: Mapped[Document] = relationship(back_populates="chunks")

    __table_args__ = (
        UniqueConstraint("document_id", "ordinal", name="uq_chunk_document_ordinal"),
        Index("ix_chunks_space", "space_id"),
    )


class GenerationRun(Base):
    __tablename__ = "generation_runs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    space_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.knowledge_spaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    plan: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    # pending | ready | failed
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    error: Mapped[str | None] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(String(120))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    questions: Mapped[list[GeneratedQuestion]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("status IN ('pending','ready','failed')", name="ck_run_status"),
        Index("ix_runs_space_created", "space_id", "created_at"),
    )


class GeneratedQuestion(Base):
    __tablename__ = "generated_questions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.generation_runs.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    # MCQ | TRUE_FALSE — extensible; see generation/schemas.py
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    difficulty: Mapped[str | None] = mapped_column(String(16))
    stem: Mapped[str] = mapped_column(Text, nullable=False)
    # [{ "title": str, "isCorrect": bool }] — already in the shape the Nest
    # import endpoint expects, so export is a pass-through.
    options: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text)
    discarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    run: Mapped[GenerationRun] = relationship(back_populates="questions")
    citations: Mapped[list[QuestionCitation]] = relationship(
        back_populates="question", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("run_id", "ordinal", name="uq_question_run_ordinal"),)


class QuestionCitation(Base):
    __tablename__ = "question_citations"

    id: Mapped[uuid.UUID] = _uuid_pk()
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.generated_questions.id", ondelete="CASCADE"), nullable=False
    )
    # Chunks can be deleted (document re-ingested) without destroying the run's
    # history, so this is intentionally SET NULL rather than CASCADE.
    chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{SCHEMA}.chunks.id", ondelete="SET NULL")
    )
    # Snapshot, so a citation still renders after its chunk is gone.
    document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    document_name: Mapped[str] = mapped_column(String(500), nullable=False)
    page_start: Mapped[int | None] = mapped_column(Integer)
    page_end: Mapped[int | None] = mapped_column(Integer)
    heading_path: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    rank: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    question: Mapped[GeneratedQuestion] = relationship(back_populates="citations")
