"""Document upload, listing, status and retry."""

import uuid
from pathlib import Path

import structlog
from fastapi import APIRouter, File, UploadFile, status

from buzrr_ai.api.schemas import DocumentOut, SpaceStatusOut
from buzrr_ai.auth import CurrentUser
from buzrr_ai.db.models import Document
from buzrr_ai.db.repositories import documents as repo
from buzrr_ai.db.repositories import spaces as spaces_repo
from buzrr_ai.db.session import DbSession
from buzrr_ai.deps import QueueDep, SettingsDep
from buzrr_ai.errors import BadRequest
from buzrr_ai.ingestion import storage
from buzrr_ai.ingestion.parsers import SUPPORTED_EXTENSIONS
from buzrr_ai.ratelimit import enforce

log = structlog.get_logger(__name__)
router = APIRouter(tags=["documents"])


def _out(doc: Document) -> DocumentOut:
    return DocumentOut(
        id=doc.id,
        filename=doc.filename,
        extension=doc.extension,
        sizeBytes=doc.size_bytes,
        status=doc.status,
        error=doc.error,
        pageCount=doc.page_count,
        chunkCount=doc.chunk_count,
        createdAt=doc.created_at,
        processedAt=doc.processed_at,
    )


@router.post(
    "/spaces/{space_id}/documents",
    response_model=list[DocumentOut],
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_documents(
    space_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    settings: SettingsDep,
    queue: QueueDep,
    files: list[UploadFile] = File(...),  # noqa: B008 — FastAPI's documented idiom
) -> list[DocumentOut]:
    await spaces_repo.get_space(db, user.user_id, space_id)

    if not files:
        raise BadRequest("No files were uploaded")
    if len(files) > settings.ai_max_files:
        raise BadRequest(f"At most {settings.ai_max_files} files per upload")

    await enforce(
        queue,
        user_id=user.user_id,
        action="uploads",
        limit=settings.ai_rate_uploads_per_hour,
        window_seconds=3600,
    )

    # Validate the whole batch first. Rejecting file 3 mid-loop would leave
    # files 1 and 2 persisted and enqueued while the client sees only a 400 —
    # orphan documents in the space that the user never knowingly uploaded.
    names_and_extensions: list[tuple[str, str]] = []
    for upload in files:
        filename = (upload.filename or "untitled").strip()
        extension = Path(filename).suffix.lower()
        if extension not in SUPPORTED_EXTENSIONS:
            raise BadRequest(
                f"{filename}: unsupported file type. "
                f"Allowed: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )
        names_and_extensions.append((filename, extension))

    max_bytes = settings.ai_max_upload_mb * 1024 * 1024
    created: list[Document] = []

    for upload, (filename, extension) in zip(files, names_and_extensions, strict=True):
        # Write to a staging name first — the document id isn't known until the
        # row exists, and the row shouldn't exist until the bytes are safely down.
        staging = storage.temp_path(settings.ai_tmp_dir, uuid.uuid4(), ".part")
        try:
            size, sha256 = await storage.stream_to_disk(upload, staging, max_bytes=max_bytes)
        except storage.UploadTooLarge as exc:
            raise BadRequest(f"{filename}: {exc}") from exc

        if size == 0:
            storage.discard(staging)
            raise BadRequest(f"{filename}: file is empty")

        existing = await repo.find_by_hash(db, space_id, sha256)
        if existing is not None:
            # Same bytes already in this space — don't index it twice.
            storage.discard(staging)
            created.append(existing)
            continue

        document = await repo.create_document(
            db,
            user_id=user.user_id,
            space_id=space_id,
            filename=filename,
            extension=extension,
            size_bytes=size,
            sha256=sha256,
        )
        staging.rename(storage.temp_path(settings.ai_tmp_dir, document.id, extension))
        await queue.enqueue_job("ingest_document", str(document.id))
        created.append(document)

    log.info("documents_uploaded", space_id=str(space_id), count=len(created))
    return [_out(d) for d in created]


@router.get("/spaces/{space_id}/documents", response_model=list[DocumentOut])
async def list_documents(
    space_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> list[DocumentOut]:
    await spaces_repo.get_space(db, user.user_id, space_id)
    return [_out(d) for d in await repo.list_documents(db, user.user_id, space_id)]


@router.get("/spaces/{space_id}/status", response_model=SpaceStatusOut)
async def space_status(space_id: uuid.UUID, user: CurrentUser, db: DbSession) -> SpaceStatusOut:
    await spaces_repo.get_space(db, user.user_id, space_id)
    counts = await repo.status_counts(db, space_id)
    documents = await repo.list_documents(db, user.user_id, space_id)
    return SpaceStatusOut(
        counts=counts,
        documents=[_out(d) for d in documents],
        isProcessing=counts["queued"] + counts["processing"] > 0,
    )


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID, user: CurrentUser, db: DbSession, settings: SettingsDep
) -> None:
    document = await repo.get_document(db, user.user_id, document_id)
    # A failed document still has its source file on disk (kept so retry works);
    # deleting the document must take that with it.
    storage.discard(storage.temp_path(settings.ai_tmp_dir, document.id, document.extension))
    await repo.delete_document(db, user.user_id, document_id)


@router.post("/documents/{document_id}/retry", response_model=DocumentOut)
async def retry_document(
    document_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    settings: SettingsDep,
    queue: QueueDep,
) -> DocumentOut:
    document = await repo.get_document(db, user.user_id, document_id)
    if document.status not in ("failed",):
        raise BadRequest("Only failed documents can be retried")

    path = storage.temp_path(settings.ai_tmp_dir, document.id, document.extension)
    if not path.exists():
        # The temp file is gone (deleted after the failed attempt, or the worker
        # restarted). There is nothing to re-parse — be honest about it.
        raise BadRequest("The uploaded file is no longer on the server. Please upload it again.")

    document.status = "queued"
    document.error = None
    await db.commit()
    await db.refresh(document)
    await queue.enqueue_job("ingest_document", str(document.id))
    return _out(document)
