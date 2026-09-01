"""Citation mapping and context labelling.

The label indirection (`[S1]`, `[S2]`, …) is what makes citations trustworthy:
the model never sees a UUID, and a label it invents simply fails to resolve
rather than producing a bogus source.
"""

import uuid

from buzrr_ai.db.models import GenerationRun
from buzrr_ai.generation.schemas import McqQuestion, Option, QuestionSet, TrueFalseQuestion
from buzrr_ai.generation.service import _persist_questions
from buzrr_ai.rag.context import build_context
from buzrr_ai.rag.retriever import RetrievedChunk


def _chunk(name: str, text: str, page: int = 3, path: list[str] | None = None) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        document_name=name,
        text=text,
        page_start=page,
        page_end=page,
        heading_path=path if path is not None else ["Unit 4", "Subsection 2"],
        score=0.9,
    )


def _mcq(refs: list[str]) -> McqQuestion:
    return McqQuestion(
        stem="What is entropy?",
        options=[
            Option(title="A measure of disorder", isCorrect=True),
            Option(title="A measure of mass", isCorrect=False),
            Option(title="A measure of charge", isCorrect=False),
            Option(title="A measure of length", isCorrect=False),
        ],
        source_refs=refs,
    )


def test_context_labels_are_sequential_and_mapped() -> None:
    chunks = [_chunk("a.pdf", "alpha"), _chunk("b.pdf", "beta")]
    built = build_context(chunks)
    assert "[S1]" in built.text and "[S2]" in built.text
    assert set(built.by_label) == {"S1", "S2"}
    assert built.by_label["S2"].text == "beta"


def test_context_header_carries_source_section_and_page() -> None:
    built = build_context([_chunk("thermo.pdf", "alpha", page=7)])
    assert "thermo.pdf" in built.text
    assert "Unit 4 > Subsection 2" in built.text
    assert "p.7" in built.text


def test_context_respects_the_character_budget() -> None:
    chunks = [_chunk(f"{i}.pdf", "x" * 500) for i in range(20)]
    built = build_context(chunks, budget_chars=1200)
    assert len(built.by_label) < 20
    assert len(built.by_label) >= 1


def test_citations_resolve_to_the_right_chunk() -> None:
    chunks = [_chunk("a.pdf", "alpha"), _chunk("b.pdf", "beta", page=9)]
    built = build_context(chunks)
    run = GenerationRun(id=uuid.uuid4(), space_id=uuid.uuid4(), user_id="u", prompt="p")

    rows = _persist_questions(run, QuestionSet(questions=[_mcq(["S2"])]), built.by_label, "u")

    assert len(rows) == 1
    assert len(rows[0].citations) == 1
    citation = rows[0].citations[0]
    assert citation.document_name == "b.pdf"
    assert citation.page_start == 9
    assert citation.heading_path == ["Unit 4", "Subsection 2"]


def test_hallucinated_labels_are_dropped_not_trusted() -> None:
    built = build_context([_chunk("a.pdf", "alpha")])
    run = GenerationRun(id=uuid.uuid4(), space_id=uuid.uuid4(), user_id="u", prompt="p")

    rows = _persist_questions(
        run, QuestionSet(questions=[_mcq(["S1", "S9", "banana"])]), built.by_label, "u"
    )

    assert [c.document_name for c in rows[0].citations] == ["a.pdf"]


def test_duplicate_labels_produce_one_citation() -> None:
    built = build_context([_chunk("a.pdf", "alpha")])
    run = GenerationRun(id=uuid.uuid4(), space_id=uuid.uuid4(), user_id="u", prompt="p")
    rows = _persist_questions(
        run, QuestionSet(questions=[_mcq(["S1", "s1", "S1"])]), built.by_label, "u"
    )
    assert len(rows[0].citations) == 1


def test_true_false_persists_as_two_options() -> None:
    built = build_context([_chunk("a.pdf", "alpha")])
    run = GenerationRun(id=uuid.uuid4(), space_id=uuid.uuid4(), user_id="u", prompt="p")
    question = TrueFalseQuestion(stem="Entropy always increases.", answer=True, source_refs=["S1"])

    rows = _persist_questions(run, QuestionSet(questions=[question]), built.by_label, "u")

    assert rows[0].type == "TRUE_FALSE"
    assert rows[0].options == [
        {"title": "True", "isCorrect": True},
        {"title": "False", "isCorrect": False},
    ]
