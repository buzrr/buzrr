"""Structured-output schemas.

These Pydantic models *are* the contract with the model: they're handed to Gemini
as a `response_schema`, so the model returns JSON that already validates. This is
the deliberate replacement for the existing Nest path, which asks for a text
layout and parses it with `split("\\n\\n")` (docs/CONTEXT.md debt #6).

**Adding a question type** is three edits, all in this file plus one prompt
fragment: add the enum member, add a model with its `type` literal, add it to the
`GeneratedQuestion` union. Nothing downstream needs to change — the API,
persistence and export layers all work off `options`/`stem`.
"""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class QuestionType(StrEnum):
    MCQ = "MCQ"
    TRUE_FALSE = "TRUE_FALSE"


class Difficulty(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class Option(BaseModel):
    title: str = Field(description="The option text shown to the player.")
    isCorrect: bool  # noqa: N815 — matches the Buzrr Option model exactly


class _BaseQuestion(BaseModel):
    stem: str = Field(
        description="The question text. Self-contained; never refers to 'the passage'."
    )
    difficulty: Difficulty = Difficulty.MEDIUM
    explanation: str = Field(
        default="",
        description="One or two sentences on why the correct answer is correct.",
    )
    source_refs: list[str] = Field(
        default_factory=list,
        description=(
            "Labels of the context excerpts this question came from, e.g. "
            "['S3','S7']. Use only labels present in the provided context."
        ),
    )


class McqQuestion(_BaseQuestion):
    type: Literal[QuestionType.MCQ] = QuestionType.MCQ
    options: list[Option] = Field(description="Exactly 4 options, exactly one correct.")

    @model_validator(mode="after")
    def _shape(self) -> "McqQuestion":
        if len(self.options) != 4:
            raise ValueError("an MCQ must have exactly 4 options")
        if sum(1 for o in self.options if o.isCorrect) != 1:
            raise ValueError("an MCQ must have exactly one correct option")
        return self


class TrueFalseQuestion(_BaseQuestion):
    type: Literal[QuestionType.TRUE_FALSE] = QuestionType.TRUE_FALSE
    answer: bool = Field(description="True if the statement in `stem` is true.")

    @property
    def options(self) -> list[Option]:
        return [
            Option(title="True", isCorrect=self.answer),
            Option(title="False", isCorrect=not self.answer),
        ]


# A plain union, deliberately *not* `Field(discriminator="type")`. A tagged union
# serialises to JSON Schema as `oneOf` + `discriminator`, and neither is a member
# of the Schema type `google-genai` accepts as a `response_schema` — it rejects
# both as `extra_forbidden` before a request is ever sent. An untagged union
# serialises to `anyOf`, which the SDK and Gemini both accept. Nothing is lost on
# the parse side: `type` is a `Literal` on each variant, so pydantic's smart-union
# mode still resolves the right one. Keep it untagged.
GeneratedQuestion = McqQuestion | TrueFalseQuestion


class QuestionSet(BaseModel):
    """What the model returns for one generation request."""

    questions: list[GeneratedQuestion] = Field(default_factory=list)
