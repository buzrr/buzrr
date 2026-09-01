"""Request/response models for the HTTP surface.

Field names are camelCase because the web client consumes them directly
alongside Nest responses, which are camelCase throughout.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from buzrr_ai.generation.schemas import QuestionType


class CreateSpaceBody(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class UpdateSpaceBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class SpaceOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    documentCount: int = 0
    readyCount: int = 0
    createdAt: datetime
    updatedAt: datetime


class DocumentOut(BaseModel):
    id: uuid.UUID
    filename: str
    extension: str
    sizeBytes: int
    status: str
    error: str | None
    pageCount: int | None
    chunkCount: int
    createdAt: datetime
    processedAt: datetime | None


class SpaceStatusOut(BaseModel):
    counts: dict[str, int]
    documents: list[DocumentOut]
    isProcessing: bool


class GenerateBody(BaseModel):
    prompt: str = Field(min_length=3, max_length=2000)
    questionTypes: list[QuestionType] | None = None
    count: int | None = Field(default=None, ge=1, le=30)


class CitationOut(BaseModel):
    documentId: uuid.UUID | None
    documentName: str
    pageStart: int | None
    pageEnd: int | None
    headingPath: list[str]


class OptionOut(BaseModel):
    title: str
    isCorrect: bool


class QuestionOut(BaseModel):
    id: uuid.UUID
    type: str
    difficulty: str | None
    stem: str
    options: list[OptionOut]
    explanation: str | None
    discarded: bool
    citations: list[CitationOut]


class RunOut(BaseModel):
    id: uuid.UUID
    spaceId: uuid.UUID
    prompt: str
    status: str
    error: str | None
    model: str | None
    latencyMs: int | None
    createdAt: datetime
    questions: list[QuestionOut]


class RunSummaryOut(BaseModel):
    id: uuid.UUID
    prompt: str
    status: str
    questionCount: int
    createdAt: datetime


class UpdateQuestionBody(BaseModel):
    stem: str | None = Field(default=None, min_length=1, max_length=2000)
    options: list[OptionOut] | None = None
    discarded: bool | None = None
