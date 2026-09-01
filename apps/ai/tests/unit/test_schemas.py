"""Structured-output schema validation.

These constraints are what stop a malformed model response from reaching the
database — the failure mode the existing Nest text-parsing path has.
"""

import pytest
from pydantic import ValidationError

from buzrr_ai.generation.schemas import (
    McqQuestion,
    Option,
    QuestionSet,
    QuestionType,
    TrueFalseQuestion,
)


def _options(correct: int = 1, total: int = 4) -> list[Option]:
    return [Option(title=f"opt{i}", isCorrect=i < correct) for i in range(total)]


def test_valid_mcq() -> None:
    q = McqQuestion(stem="Q?", options=_options())
    assert q.type is QuestionType.MCQ
    assert sum(o.isCorrect for o in q.options) == 1


def test_mcq_rejects_wrong_option_count() -> None:
    with pytest.raises(ValidationError, match="exactly 4 options"):
        McqQuestion(stem="Q?", options=_options(total=3))


def test_mcq_rejects_multiple_correct_answers() -> None:
    with pytest.raises(ValidationError, match="exactly one correct"):
        McqQuestion(stem="Q?", options=_options(correct=2))


def test_mcq_rejects_no_correct_answer() -> None:
    with pytest.raises(ValidationError, match="exactly one correct"):
        McqQuestion(stem="Q?", options=_options(correct=0))


def test_true_false_derives_its_options() -> None:
    assert TrueFalseQuestion(stem="S", answer=False).options == [
        Option(title="True", isCorrect=False),
        Option(title="False", isCorrect=True),
    ]


def test_question_set_discriminates_on_type() -> None:
    payload = {
        "questions": [
            {"type": "MCQ", "stem": "Q?", "options": [o.model_dump() for o in _options()]},
            {"type": "TRUE_FALSE", "stem": "S", "answer": True},
        ]
    }
    parsed = QuestionSet.model_validate(payload)
    assert isinstance(parsed.questions[0], McqQuestion)
    assert isinstance(parsed.questions[1], TrueFalseQuestion)


def test_question_set_converts_to_a_gemini_response_schema() -> None:
    """The schema has to survive `google-genai`'s Schema conversion.

    Regression guard: a discriminated union serialises to `oneOf` +
    `discriminator`, which that Schema type forbids, so `response_schema` blew
    up at request time and every generation returned a 502. Failing here — with
    no network and no API key — is far cheaper than failing in production.
    """
    from google.genai import _transformers

    schema = _transformers.t_schema(None, QuestionSet)
    assert schema is not None


def test_option_field_name_matches_the_buzrr_model() -> None:
    # `isCorrect`, not `is_correct` — export to the Nest import endpoint is a
    # pass-through, so the casing has to line up with Prisma's Option model.
    assert "isCorrect" in Option(title="x", isCorrect=True).model_dump()
