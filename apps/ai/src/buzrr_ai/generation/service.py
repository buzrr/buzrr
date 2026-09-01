"""Generation orchestration: plan → retrieve → build context → generate → persist."""

import time
import uuid

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from buzrr_ai.config import Settings
from buzrr_ai.db.models import GeneratedQuestion as GeneratedQuestionRow
from buzrr_ai.db.models import GenerationRun, QuestionCitation
from buzrr_ai.db.repositories import spaces as spaces_repo
from buzrr_ai.errors import BadRequest
from buzrr_ai.generation.prompts import SYSTEM, build_generation_prompt
from buzrr_ai.generation.schemas import QuestionSet, QuestionType
from buzrr_ai.providers.base import EmbeddingProvider, LLMProvider
from buzrr_ai.rag.context import build_context
from buzrr_ai.rag.planner import plan_retrieval
from buzrr_ai.rag.retriever import RetrievedChunk, retrieve, space_headings

log = structlog.get_logger(__name__)


async def generate_questions(
    db: AsyncSession,
    *,
    settings: Settings,
    llm: LLMProvider,
    embeddings: EmbeddingProvider,
    user_id: str,
    space_id: uuid.UUID,
    prompt: str,
    question_types: list[QuestionType] | None,
    count: int | None,
) -> GenerationRun:
    await spaces_repo.get_space(db, user_id, space_id)

    if await spaces_repo.space_chunk_count(db, space_id) == 0:
        raise BadRequest(
            "This knowledge space has no processed documents yet. "
            "Upload a document and wait for it to finish processing."
        )

    started = time.perf_counter()
    run = GenerationRun(space_id=space_id, user_id=user_id, prompt=prompt, status="pending")
    db.add(run)
    await db.commit()
    await db.refresh(run)

    binder = log.bind(run_id=str(run.id), space_id=str(space_id))

    try:
        headings = await space_headings(db, space_id)
        plan = await plan_retrieval(
            llm,
            prompt=prompt,
            headings=headings,
            requested_types=question_types,
            requested_count=count,
        )
        binder.info(
            "generation_planned",
            query=plan.search_query,
            filter=plan.section_filter,
            count=plan.question_count,
        )

        chunks = await retrieve(
            db,
            settings=settings,
            embeddings=embeddings,
            user_id=user_id,
            space_id=space_id,
            query=plan.search_query,
            section_filter=plan.section_filter,
        )
        if not chunks:
            raise BadRequest(
                "Couldn't find anything relevant in this knowledge space for that request."
            )

        context = build_context(chunks)
        result = await llm.structured(
            system=SYSTEM,
            prompt=build_generation_prompt(
                user_prompt=prompt,
                count=plan.question_count,
                types=plan.question_types,
                difficulty=plan.difficulty,
                context=context.text,
            ),
            schema=QuestionSet,
            temperature=0.6,
        )

        rows = _persist_questions(run, result, context.by_label, user_id)
        if not rows:
            raise BadRequest(
                "Couldn't generate usable questions from that material. "
                "Try a narrower request or a different section."
            )

        db.add_all(rows)
        run.status = "ready"
        run.plan = plan.model_dump(mode="json")
        run.model = llm.model
        run.latency_ms = int((time.perf_counter() - started) * 1000)
        await db.commit()
        await db.refresh(run)
        binder.info("generation_ready", questions=len(rows), latency_ms=run.latency_ms)
        return run

    except Exception as exc:
        await db.rollback()
        run.status = "failed"
        run.error = str(exc)[:2000]
        run.latency_ms = int((time.perf_counter() - started) * 1000)
        await db.commit()
        binder.warning("generation_failed", error=str(exc))
        raise


def _persist_questions(
    run: GenerationRun,
    result: QuestionSet,
    by_label: dict[str, RetrievedChunk],
    user_id: str,
) -> list[GeneratedQuestionRow]:
    rows: list[GeneratedQuestionRow] = []

    for ordinal, question in enumerate(result.questions):
        # Both variants expose `.options` — TrueFalseQuestion derives its pair
        # from `answer` — so the row shape is uniform regardless of type.
        options = [o.model_dump() for o in question.options]

        row = GeneratedQuestionRow(
            run_id=run.id,
            user_id=user_id,
            ordinal=ordinal,
            type=str(question.type),
            difficulty=str(question.difficulty),
            stem=question.stem,
            options=options,
            explanation=question.explanation or None,
        )

        # Unknown labels are dropped rather than trusted — a hallucinated "S9"
        # yields no citation instead of a fabricated one.
        seen: set[uuid.UUID] = set()
        rank = 0
        for label in question.source_refs:
            chunk = by_label.get(label.strip().upper())
            if chunk is None or chunk.chunk_id in seen:
                continue
            seen.add(chunk.chunk_id)
            row.citations.append(
                QuestionCitation(
                    chunk_id=chunk.chunk_id,
                    document_id=chunk.document_id,
                    document_name=chunk.document_name,
                    page_start=chunk.page_start,
                    page_end=chunk.page_end,
                    heading_path=chunk.heading_path,
                    rank=rank,
                )
            )
            rank += 1

        rows.append(row)

    return rows
