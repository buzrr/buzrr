"""Document parsers.

Each parser turns a file into an ordered list of `Block`s. Everything
format-specific stops here — the chunker downstream only ever sees blocks.
"""

from pathlib import Path

from buzrr_ai.errors import BadRequest
from buzrr_ai.ingestion.parsers.base import Block, ParsedDocument
from buzrr_ai.ingestion.parsers.docx import parse_docx
from buzrr_ai.ingestion.parsers.pdf import parse_pdf
from buzrr_ai.ingestion.parsers.text import parse_markdown

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}


def parse(path: Path, extension: str) -> ParsedDocument:
    match extension.lower():
        case ".pdf":
            return parse_pdf(path)
        case ".docx":
            return parse_docx(path)
        case ".txt" | ".md":
            return parse_markdown(path)
        case _:
            raise BadRequest(f"Unsupported file type: {extension}")


__all__ = ["Block", "ParsedDocument", "SUPPORTED_EXTENSIONS", "parse"]
