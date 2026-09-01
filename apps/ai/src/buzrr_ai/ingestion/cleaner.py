"""Text normalisation applied before chunking."""

import re
import unicodedata
from collections import Counter

from buzrr_ai.ingestion.parsers.base import Block

_WS = re.compile(r"[ \t ]+")
_HYPHEN_BREAK = re.compile(r"(\w)-\s*\n\s*(\w)")
_BULLET = re.compile(r"^\s*[•●▪·⁃\-\*]\s+")
_PAGE_NUMBER = re.compile(r"^\s*(page\s+)?\d{1,4}(\s*/\s*\d{1,4})?\s*$", re.IGNORECASE)


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = _HYPHEN_BREAK.sub(r"\1\2", text)  # rejoin words split across a line break
    text = text.replace("​", "")
    text = _BULLET.sub("- ", text)
    return _WS.sub(" ", text).strip()


def clean_blocks(blocks: list[Block], *, page_count: int | None) -> list[Block]:
    """Normalise text and drop scanning noise.

    Running headers/footers are the main problem in real course PDFs: the same
    line on every page otherwise lands in every chunk and dilutes retrieval. They
    are detected by repetition across pages rather than by position, which
    survives inconsistent margins.
    """
    repeated = _repeated_lines(blocks, page_count)

    cleaned: list[Block] = []
    for block in blocks:
        text = normalize(block.text)
        if not text:
            continue
        if _PAGE_NUMBER.match(text):
            continue
        if text in repeated:
            continue
        cleaned.append(Block(text=text, page=block.page, heading_level=block.heading_level))
    return cleaned


def _repeated_lines(blocks: list[Block], page_count: int | None) -> set[str]:
    if not page_count or page_count < 4:
        return set()

    # Count each short line once per page it appears on.
    per_page: dict[str, set[int]] = {}
    for block in blocks:
        text = normalize(block.text)
        if not text or len(text) > 120:
            continue
        per_page.setdefault(text, set()).add(block.page)

    threshold = max(3, int(page_count * 0.5))
    counts = Counter({text: len(pages) for text, pages in per_page.items()})
    return {text for text, count in counts.items() if count >= threshold}
