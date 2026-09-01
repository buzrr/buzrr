"""Generation runs and the questions they produce."""

import uuid

from fastapi import APIRouter, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from buzrr_ai.api.schemas import (
    CitationOut,
    GenerateBody,
    OptionOut,
    QuestionOut,
    RunOut,
    RunSummaryOut,
    UpdateQuestionBody,
)
from buzrr_ai.auth import CurrentUser
from buzrr_ai.db.models import GeneratedQuestion, GenerationRun
from buzrr_ai.db.repositories import spaces as spaces_repo
from buzrr_ai.db.session import DbSession
from buzrr_ai.deps import EmbeddingsDep, LLMDep, QueueDep, SettingsDep
from buzrr_ai.errors import BadRequest, NotFound
from buzrr_ai.generation.service import generate_questions
from buzrr_ai.ratelimit import enforce

router = APIRouter(tags=["generation"])


def _question_out(q: GeneratedQuestion) -> QuestionOut:
    return QuestionOut(
        id=q.id,
        type=q.type,
        difficulty=q.difficulty,
        stem=q.stem,
        options=[OptionOut(**o) for o in q.options],
        explanation=q.explanation,
        discarded=q.discarded,
        citations=[
            CitationOut(
                documentId=c.document_id,
                documentName=c.document_name,
                pageStart=c.page_start,
                pageEnd=c.page_end,
                headingPath=list(c.heading_path or []),
            )
            for c in sorted(q.citations, key=lambda c: c.rank)
        ],
    )


def _run_out(run: GenerationRun) -> RunOut:
    return RunOut(
        id=run.id,
        spaceId=run.space_id,
        prompt=run.prompt,
        status=run.status,
        error=run.error,
        model=run.model,
        latencyMs=run.latency_ms,
        createdAt=run.created_at,
        questions=[_question_out(q) for q in sorted(run.questions, key=lambda q: q.ordinal)],
    )


async def _load_run(db: DbSession, user_id: str, run_id: uuid.UUID) -> GenerationRun:
    stmt = (
        select(GenerationRun)
        .where(GenerationRun.id == run_id, GenerationRun.user_id == user_id)
        .options(selectinload(GenerationRun.questions).selectinload(GeneratedQuestion.citations))
    )
    run = (await db.execute(stmt)).scalar_one_or_none()
    if run is None:
        raise NotFound("Unauthorized or generation run not found")
    return run


@router.post("/spaces/{space_id}/generate", response_model=RunOut)
async def generate(
    space_id: uuid.UUID,
    body: GenerateBody,
    user: CurrentUser,
    db: DbSession,
    settings: SettingsDep,
    llm: LLMDep,
    embeddings: EmbeddingsDep,
    queue: QueueDep,
) -> RunOut:
    await enforce(
        queue,
        user_id=user.user_id,
        action="generations",
        limit=settings.ai_rate_generations_per_hour,
        window_seconds=3600,
    )

    run = await generate_questions(
        db,
        settings=settings,
        llm=llm,
        embeddings=embeddings,
        user_id=user.user_id,
        space_id=space_id,
        prompt=body.prompt,
        question_types=body.questionTypes,
        count=body.count,
    )
    return _run_out(await _load_run(db, user.user_id, run.id))


@router.get("/spaces/{space_id}/runs", response_model=list[RunSummaryOut])
async def list_runs(space_id: uuid.UUID, user: CurrentUser, db: DbSession) -> list[RunSummaryOut]:
    await spaces_repo.get_space(db, user.user_id, space_id)
    counts = (
        select(
            GenerationRun.id,
            GenerationRun.prompt,
            GenerationRun.status,
            GenerationRun.created_at,
            func.count(GeneratedQuestion.id).label("question_count"),
        )
        .outerjoin(GeneratedQuestion, GeneratedQuestion.run_id == GenerationRun.id)
        .where(GenerationRun.space_id == space_id, GenerationRun.user_id == user.user_id)
        .group_by(GenerationRun.id)
        .order_by(GenerationRun.created_at.desc())
        .limit(50)
    )
    return [
        RunSummaryOut(
            id=row.id,
            prompt=row.prompt,
            status=row.status,
            questionCount=int(row.question_count),
            createdAt=row.created_at,
        )
        for row in (await db.execute(counts)).all()
    ]


@router.get("/runs/{run_id}", response_model=RunOut)
async def get_run(run_id: uuid.UUID, user: CurrentUser, db: DbSession) -> RunOut:
    return _run_out(await _load_run(db, user.user_id, run_id))


@router.patch("/runs/{run_id}/questions/{question_id}", response_model=QuestionOut)
async def update_question(
    run_id: uuid.UUID,
    question_id: uuid.UUID,
    body: UpdateQuestionBody,
    user: CurrentUser,
    db: DbSession,
) -> QuestionOut:
    stmt = (
        select(GeneratedQuestion)
        .where(
            GeneratedQuestion.id == question_id,
            GeneratedQuestion.run_id == run_id,
            GeneratedQuestion.user_id == user.user_id,
        )
        .options(selectinload(GeneratedQuestion.citations))
    )
    question = (await db.execute(stmt)).scalar_one_or_none()
    if question is None:
        raise NotFound("Unauthorized or question not found")

    if body.stem is not None:
        question.stem = body.stem
    if body.options is not None:
        if len(body.options) < 2:
            raise BadRequest("A question needs at least 2 options")
        if sum(1 for o in body.options if o.isCorrect) != 1:
            raise BadRequest("Exactly one option must be correct")
        question.options = [o.model_dump() for o in body.options]
    if body.discarded is not None:
        question.discarded = body.discarded

    await db.commit()
    await db.refresh(question)
    return _question_out(question)


@router.delete("/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_run(run_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    run = await _load_run(db, user.user_id, run_id)
    await db.delete(run)
    await db.commit()
