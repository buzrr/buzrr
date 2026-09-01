"""End-to-end: upload → ingest → retrieve → generate → cite.

Runs the real pipeline (real parsers, real chunker, real pgvector queries) with
only the two providers faked. This is the test that would catch a regression in
the parts that actually decide whether the feature works.
"""

import uuid
from pathlib import Path

import pymupdf
import pytest
from sqlalchemy import func, select

from buzrr_ai.config import get_settings
from buzrr_ai.db.models import Chunk, Document
from buzrr_ai.db.repositories import documents as documents_repo
from buzrr_ai.errors import UpstreamRateLimited
from buzrr_ai.generation.schemas import McqQuestion, Option, QuestionSet
from buzrr_ai.ingestion import storage
from buzrr_ai.ingestion.pipeline import ingest_document
from buzrr_ai.rag.planner import RetrievalPlan
from buzrr_ai.rag.retriever import retrieve
from tests.fakes import FakeEmbeddings
from tests.integration.conftest import auth

pytestmark = pytest.mark.asyncio

MARKDOWN = """# Unit 4: Thermodynamics

Thermodynamics is the study of heat, work and energy transfer between systems.

## Subsection 1: The First Law

The first law states that energy cannot be created or destroyed, only converted
between forms. Internal energy change equals heat added minus work done.

## Subsection 2: The Second Law

The second law states that the entropy of an isolated system never decreases.
Entropy is a measure of disorder. Heat flows spontaneously from hot to cold.
The Carnot efficiency bounds any heat engine operating between two reservoirs.

# Unit 5: Chemical Kinetics

Reaction rate depends on concentration, temperature and catalysts. The Arrhenius
equation relates the rate constant to activation energy.
"""


def _write_pdf(path: Path) -> None:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 100), "Unit 9: Optics", fontsize=22)
    page.insert_text((72, 140), "Light refracts when it changes medium.", fontsize=11)
    doc.save(path)
    doc.close()


async def _space(client, token, name="Notes") -> str:  # type: ignore[no-untyped-def]
    r = await client.post("/api/ai/spaces", json={"name": name}, headers=auth(token))
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _upload(client, token, space_id, filename, content: bytes):  # type: ignore[no-untyped-def]
    return await client.post(
        f"/api/ai/spaces/{space_id}/documents",
        files=[("files", (filename, content, "application/octet-stream"))],
        headers=auth(token),
    )


# --------------------------------------------------------------------------- #
# Upload validation
# --------------------------------------------------------------------------- #


async def test_upload_queues_a_job_and_writes_a_temp_file(  # type: ignore[no-untyped-def]
    client, alice_token, stub_queue
) -> None:
    space_id = await _space(client, alice_token)
    response = await _upload(client, alice_token, space_id, "notes.md", MARKDOWN.encode())

    assert response.status_code == 202, response.text
    body = response.json()
    assert body[0]["status"] == "queued"
    assert stub_queue.jobs == [("ingest_document", (body[0]["id"],))]

    settings = get_settings()
    path = storage.temp_path(settings.ai_tmp_dir, uuid.UUID(body[0]["id"]), ".md")
    assert path.exists(), "the uploaded bytes should be staged on disk"


async def test_unsupported_extension_is_rejected(client, alice_token) -> None:  # type: ignore[no-untyped-def]
    space_id = await _space(client, alice_token)
    response = await _upload(client, alice_token, space_id, "malware.exe", b"MZ\x00")
    assert response.status_code == 400
    assert "unsupported file type" in response.json()["message"].lower()


async def test_empty_file_is_rejected(client, alice_token) -> None:  # type: ignore[no-untyped-def]
    space_id = await _space(client, alice_token)
    response = await _upload(client, alice_token, space_id, "empty.txt", b"")
    assert response.status_code == 400


async def test_oversized_file_is_rejected(client, alice_token, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    get_settings.cache_clear()
    monkeypatch.setenv("AI_MAX_UPLOAD_MB", "1")
    get_settings.cache_clear()
    try:
        space_id = await _space(client, alice_token)
        response = await _upload(client, alice_token, space_id, "big.txt", b"x" * (2 * 1024 * 1024))
        assert response.status_code == 400
        assert "limit" in response.json()["message"].lower()
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()


async def test_reuploading_identical_bytes_does_not_duplicate(  # type: ignore[no-untyped-def]
    client, alice_token, stub_queue
) -> None:
    space_id = await _space(client, alice_token)
    first = await _upload(client, alice_token, space_id, "notes.md", MARKDOWN.encode())
    second = await _upload(client, alice_token, space_id, "notes-copy.md", MARKDOWN.encode())

    assert first.json()[0]["id"] == second.json()[0]["id"]
    assert len(stub_queue.jobs) == 1, "the duplicate must not be queued again"


# --------------------------------------------------------------------------- #
# The pipeline itself
# --------------------------------------------------------------------------- #


async def test_markdown_ingests_with_heading_paths_and_deletes_the_source(  # type: ignore[no-untyped-def]
    client, alice_token, db
) -> None:
    space_id = await _space(client, alice_token)
    upload = await _upload(client, alice_token, space_id, "notes.md", MARKDOWN.encode())
    document_id = uuid.UUID(upload.json()[0]["id"])

    settings = get_settings()
    indexed = await ingest_document(
        db=db, settings=settings, embeddings=FakeEmbeddings(), document_id=document_id
    )
    assert indexed > 0

    document = await db.get(Document, document_id)
    await db.refresh(document)
    assert document.status == "ready"
    assert document.chunk_count == indexed

    chunks = (
        (await db.execute(select(Chunk).where(Chunk.document_id == document_id))).scalars().all()
    )
    assert all(c.heading_path for c in chunks), "every chunk needs a heading path"
    assert any("Subsection 2" in " > ".join(c.heading_path) for c in chunks)
    assert all(len(c.embedding) == 768 for c in chunks)

    # The promise the feature makes: the source file is gone after success.
    path = storage.temp_path(settings.ai_tmp_dir, document_id, ".md")
    assert not path.exists(), "the temp source file must be deleted after processing"


async def test_pdf_ingests_with_page_numbers(client, alice_token, db, tmp_path) -> None:  # type: ignore[no-untyped-def]
    pdf_path = tmp_path / "optics.pdf"
    _write_pdf(pdf_path)

    space_id = await _space(client, alice_token)
    upload = await _upload(client, alice_token, space_id, "optics.pdf", pdf_path.read_bytes())
    document_id = uuid.UUID(upload.json()[0]["id"])

    await ingest_document(
        db=db, settings=get_settings(), embeddings=FakeEmbeddings(), document_id=document_id
    )

    chunks = (
        (await db.execute(select(Chunk).where(Chunk.document_id == document_id))).scalars().all()
    )
    assert chunks
    assert all(c.page_start == 1 for c in chunks)
    assert any("Optics" in " > ".join(c.heading_path) for c in chunks)


async def test_ingestion_is_idempotent(client, alice_token, db) -> None:  # type: ignore[no-untyped-def]
    space_id = await _space(client, alice_token)
    upload = await _upload(client, alice_token, space_id, "notes.md", MARKDOWN.encode())
    document_id = uuid.UUID(upload.json()[0]["id"])
    settings = get_settings()

    first = await ingest_document(
        db=db, settings=settings, embeddings=FakeEmbeddings(), document_id=document_id
    )
    # Re-running a `ready` document is a no-op — the conditional claim refuses it,
    # which is what stops an arq redelivery from double-indexing.
    second = await ingest_document(
        db=db, settings=settings, embeddings=FakeEmbeddings(), document_id=document_id
    )

    assert first > 0
    assert second == 0
    total = (
        await db.execute(select(func.count(Chunk.id)).where(Chunk.document_id == document_id))
    ).scalar_one()
    assert total == first


async def test_a_provider_quota_blip_requeues_rather_than_failing(  # type: ignore[no-untyped-def]
    client, alice_token, db
) -> None:
    """A 429 from the provider says nothing about the document.

    Marking it `failed` here would strand a perfectly good file behind a manual
    retry, so the row goes back to `queued` and the worker defers the job.
    """
    space_id = await _space(client, alice_token)
    upload = await _upload(client, alice_token, space_id, "notes.md", MARKDOWN.encode())
    document_id = uuid.UUID(upload.json()[0]["id"])

    class QuotaExhausted(FakeEmbeddings):
        async def embed_documents(self, texts: list[str]) -> list[list[float]]:
            raise UpstreamRateLimited()

    with pytest.raises(UpstreamRateLimited):
        await ingest_document(
            db=db, settings=get_settings(), embeddings=QuotaExhausted(), document_id=document_id
        )

    document = await db.get(Document, document_id)
    await db.refresh(document)
    assert document.status == "queued"
    assert document.error is None

    # And the source file is still on disk, so the deferred retry has something
    # to re-parse.
    path = storage.temp_path(get_settings().ai_tmp_dir, document_id, ".md")
    assert path.exists()

    # The retry then succeeds with no intervention.
    assert (
        await ingest_document(
            db=db, settings=get_settings(), embeddings=FakeEmbeddings(), document_id=document_id
        )
        > 0
    )
    await db.refresh(document)
    assert document.status == "ready"


async def test_a_failing_document_does_not_block_its_siblings(  # type: ignore[no-untyped-def]
    client, alice_token, db
) -> None:
    space_id = await _space(client, alice_token)
    good = await _upload(client, alice_token, space_id, "good.md", MARKDOWN.encode())
    bad = await _upload(client, alice_token, space_id, "bad.md", b"   \n\n   \n")

    good_id = uuid.UUID(good.json()[0]["id"])
    bad_id = uuid.UUID(bad.json()[0]["id"])
    settings = get_settings()

    await ingest_document(
        db=db, settings=settings, embeddings=FakeEmbeddings(), document_id=good_id
    )
    from buzrr_ai.ingestion.pipeline import EmptyDocument

    with pytest.raises(EmptyDocument):
        await ingest_document(
            db=db, settings=settings, embeddings=FakeEmbeddings(), document_id=bad_id
        )

    assert (await db.get(Document, good_id)).status == "ready"
    failed = await db.get(Document, bad_id)
    await db.refresh(failed)
    assert failed.status == "failed"
    assert "No readable text" in (failed.error or "")

    # The source of a *failed* document is kept so retry has something to re-parse.
    assert storage.temp_path(settings.ai_tmp_dir, bad_id, ".md").exists()
    storage.discard(storage.temp_path(settings.ai_tmp_dir, bad_id, ".md"))


async def test_stalled_documents_are_reaped(client, alice_token, db) -> None:  # type: ignore[no-untyped-def]
    from datetime import UTC, datetime, timedelta

    space_id = await _space(client, alice_token)
    upload = await _upload(client, alice_token, space_id, "notes.md", MARKDOWN.encode())
    document_id = uuid.UUID(upload.json()[0]["id"])

    await documents_repo.mark_processing(db, document_id)
    reaped = await documents_repo.reap_stalled(db, datetime.now(UTC) + timedelta(minutes=1))

    assert reaped == 1
    document = await db.get(Document, document_id)
    await db.refresh(document)
    assert document.status == "failed"


# --------------------------------------------------------------------------- #
# Retrieval
# --------------------------------------------------------------------------- #


async def _ingest_notes(client, token, db) -> str:  # type: ignore[no-untyped-def]
    space_id = await _space(client, token, f"notes-{uuid.uuid4().hex[:6]}")
    upload = await _upload(client, token, space_id, "notes.md", MARKDOWN.encode())
    await ingest_document(
        db=db,
        settings=get_settings(),
        embeddings=FakeEmbeddings(),
        document_id=uuid.UUID(upload.json()[0]["id"]),
    )
    return space_id


async def test_section_filter_scopes_retrieval_to_that_subsection(  # type: ignore[no-untyped-def]
    client, alice_token, db
) -> None:
    space_id = await _ingest_notes(client, alice_token, db)

    hits = await retrieve(
        db,
        settings=get_settings(),
        embeddings=FakeEmbeddings(),
        user_id="user_alice",
        space_id=uuid.UUID(space_id),
        query="entropy and disorder",
        section_filter=["Subsection 2"],
    )

    assert hits
    for hit in hits:
        assert "Subsection 2" in " > ".join(hit.heading_path)


async def test_unmatched_section_filter_falls_back_instead_of_empty(  # type: ignore[no-untyped-def]
    client, alice_token, db
) -> None:
    space_id = await _ingest_notes(client, alice_token, db)

    hits = await retrieve(
        db,
        settings=get_settings(),
        embeddings=FakeEmbeddings(),
        user_id="user_alice",
        space_id=uuid.UUID(space_id),
        query="entropy",
        section_filter=["Chapter 99 Does Not Exist"],
    )

    assert hits, "a filter matching nothing should fall back to unfiltered search"


async def test_retrieval_never_crosses_a_tenant_boundary(  # type: ignore[no-untyped-def]
    client, alice_token, db
) -> None:
    space_id = await _ingest_notes(client, alice_token, db)

    hits = await retrieve(
        db,
        settings=get_settings(),
        embeddings=FakeEmbeddings(),
        user_id="user_bob",  # same space id, wrong owner
        space_id=uuid.UUID(space_id),
        query="entropy",
        section_filter=[],
    )

    assert hits == []


# --------------------------------------------------------------------------- #
# Generation
# --------------------------------------------------------------------------- #


async def test_generation_produces_cited_questions(  # type: ignore[no-untyped-def]
    client, alice_token, db, fake_llm
) -> None:
    space_id = await _ingest_notes(client, alice_token, db)

    fake_llm.responses = [
        RetrievalPlan(
            search_query="entropy second law",
            section_filter=["Subsection 2"],
            question_count=2,
            difficulty="hard",
        ),
        QuestionSet(
            questions=[
                McqQuestion(
                    stem="What does entropy measure?",
                    options=[
                        Option(title="Disorder", isCorrect=True),
                        Option(title="Mass", isCorrect=False),
                        Option(title="Charge", isCorrect=False),
                        Option(title="Length", isCorrect=False),
                    ],
                    source_refs=["S1"],
                ),
            ]
        ),
    ]

    response = await client.post(
        f"/api/ai/spaces/{space_id}/generate",
        json={"prompt": "Generate 2 difficult MCQs from Unit 4, Subsection 2"},
        headers=auth(alice_token),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ready"
    assert len(body["questions"]) == 1

    question = body["questions"][0]
    assert question["type"] == "MCQ"
    assert sum(o["isCorrect"] for o in question["options"]) == 1

    citations = question["citations"]
    assert citations, "a generated question must carry at least one citation"
    assert citations[0]["documentName"] == "notes.md"
    assert "Subsection 2" in " > ".join(citations[0]["headingPath"])


async def test_generation_on_an_empty_space_is_a_clear_400(client, alice_token) -> None:  # type: ignore[no-untyped-def]
    space_id = await _space(client, alice_token, "empty space")
    response = await client.post(
        f"/api/ai/spaces/{space_id}/generate",
        json={"prompt": "make questions"},
        headers=auth(alice_token),
    )
    assert response.status_code == 400
    assert "no processed documents" in response.json()["message"].lower()
