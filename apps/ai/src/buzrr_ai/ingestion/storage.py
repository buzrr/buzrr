"""Temp-file lifecycle for uploaded source documents.

Source files are a **processing input, never an asset**: they land on the
container's ephemeral disk, live only long enough to be parsed, and are deleted
whether ingestion succeeds or fails. They deliberately do not go to Cloudinary —
that is for question media, and a user's uploaded course material should never
become a publicly-addressable URL.
"""

import hashlib
import os
import time
import uuid
from pathlib import Path

import structlog
from fastapi import UploadFile

log = structlog.get_logger(__name__)

_READ_CHUNK = 1024 * 1024


class UploadTooLarge(Exception):
    def __init__(self, limit_mb: int) -> None:
        super().__init__(f"File exceeds the {limit_mb}MB limit")
        self.limit_mb = limit_mb


def temp_dir(root: str) -> Path:
    path = Path(root)
    path.mkdir(parents=True, exist_ok=True)
    return path


def temp_path(root: str, document_id: uuid.UUID, extension: str) -> Path:
    return temp_dir(root) / f"{document_id}{extension}"


async def stream_to_disk(
    upload: UploadFile, destination: Path, *, max_bytes: int
) -> tuple[int, str]:
    """Write an UploadFile to disk, hashing as we go.

    Streaming (rather than `await upload.read()`) keeps a whole upload from
    sitting in memory, and the size check aborts mid-write instead of after.
    """
    digest = hashlib.sha256()
    size = 0
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with destination.open("wb") as handle:
            while data := await upload.read(_READ_CHUNK):
                size += len(data)
                if size > max_bytes:
                    raise UploadTooLarge(max_bytes // (1024 * 1024))
                digest.update(data)
                handle.write(data)
    except Exception:
        # A single unlink on the error path; not worth an async-fs dependency.
        destination.unlink(missing_ok=True)  # noqa: ASYNC240
        raise
    return size, digest.hexdigest()


def discard(path: Path) -> None:
    """Delete a temp file. Never raises — cleanup must not mask a real error."""
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:  # pragma: no cover — defensive
        log.warning("temp_file_delete_failed", path=str(path), error=str(exc))


def sweep(root: str, *, older_than_seconds: int = 6 * 60 * 60) -> int:
    """Delete orphaned temp files left behind by a crashed worker.

    Runs at startup. Pairs with `documents.reap_stalled`, which fails the
    matching rows — together they make a mid-ingestion crash fully recoverable
    (invariant #10: recovery is a first-class path).
    """
    directory = Path(root)
    if not directory.is_dir():
        return 0
    cutoff = time.time() - older_than_seconds
    removed = 0
    for entry in directory.iterdir():
        try:
            if entry.is_file() and entry.stat().st_mtime < cutoff:
                entry.unlink()
                removed += 1
        except OSError:  # pragma: no cover
            continue
    if removed:
        log.info("temp_sweep", removed=removed, dir=root)
    return removed


def free_space_bytes(root: str) -> int:
    stat = os.statvfs(temp_dir(root))
    return stat.f_bavail * stat.f_frsize
