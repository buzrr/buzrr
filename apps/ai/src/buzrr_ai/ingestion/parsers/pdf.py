"""PDF parsing via PyMuPDF.

PyMuPDF is the pick over pypdf because it exposes per-span **font size and
weight**, which is the only signal available for heading detection in a PDF —
PDFs have no structural headings, only text that happens to look bigger. pypdf
gives plain text with no typography, which would leave every chunk with an empty
heading path.
"""

from collections import Counter
from pathlib import Path
from typing import Any

import pymupdf

from buzrr_ai.ingestion.parsers.base import Block, ParsedDocument

# A span must be this much larger than body text to count as a heading.
_HEADING_SIZE_RATIO = 1.12
_MAX_HEADING_WORDS = 25


def _line_text(line: dict[str, Any]) -> str:
    return "".join(span.get("text", "") for span in line.get("spans", [])).strip()


def _line_size(line: dict[str, Any]) -> float:
    spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
    if not spans:
        return 0.0
    # Weight by character count so a stray large glyph doesn't inflate the line.
    total_chars = sum(len(s["text"]) for s in spans)
    if total_chars == 0:
        return 0.0
    weighted = sum(float(s.get("size", 0.0)) * len(s["text"]) for s in spans)
    return weighted / total_chars


def _line_is_bold(line: dict[str, Any]) -> bool:
    spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
    if not spans:
        return False
    # PyMuPDF flags bit 4 (value 16) marks a bold face.
    return all(bool(s.get("flags", 0) & 16) for s in spans)


def parse_pdf(path: Path) -> ParsedDocument:
    doc = pymupdf.open(path)
    try:
        lines: list[tuple[int, str, float, bool]] = []
        for page_index in range(doc.page_count):
            page = doc.load_page(page_index)
            data = page.get_text("dict")
            for block in data.get("blocks", []):
                if block.get("type") != 0:  # 0 == text
                    continue
                for line in block.get("lines", []):
                    text = _line_text(line)
                    if not text:
                        continue
                    lines.append((page_index + 1, text, _line_size(line), _line_is_bold(line)))

        page_count = doc.page_count
    finally:
        doc.close()

    if not lines:
        return ParsedDocument(blocks=[], page_count=page_count)

    # Weighted by character count, not line count: body text is whatever most of
    # the *text* is set in. Counting lines breaks on short documents, where a
    # single heading line can outnumber the paragraphs.
    body_size = _dominant_size([(size, len(text)) for _, text, size, _ in lines])
    heading_sizes = sorted(
        {
            round(size, 1)
            for _, text, size, _ in lines
            if size >= body_size * _HEADING_SIZE_RATIO and len(text.split()) <= _MAX_HEADING_WORDS
        },
        reverse=True,
    )
    # Largest distinct heading size becomes level 1, next becomes level 2, and so
    # on — capped at 6 so a document with many sizes doesn't explode the path.
    size_to_level = {size: min(i + 1, 6) for i, size in enumerate(heading_sizes)}

    blocks: list[Block] = []
    for page, text, size, is_bold in lines:
        level = size_to_level.get(round(size, 1), 0)
        if level == 0 and is_bold and len(text.split()) <= 12 and not text.endswith("."):
            # Bold, short, unpunctuated at body size: a run-in subheading.
            level = 6
        blocks.append(Block(text=text, page=page, heading_level=level))

    return ParsedDocument(blocks=blocks, page_count=page_count)


def _dominant_size(sized_text: list[tuple[float, int]]) -> float:
    """The font size most of the document's characters are set in."""
    weights: Counter[float] = Counter()
    for size, chars in sized_text:
        if size > 0 and chars > 0:
            weights[round(size, 1)] += chars
    if not weights:
        return 0.0

    dominant = weights.most_common(1)[0][0]

    # A document whose largest text is also its most voluminous (a title page, a
    # slide deck) would otherwise report *everything* as body and find no
    # headings. If the dominant size is also the maximum, fall back to the
    # smallest size present, which is body text in any real layout.
    if dominant == max(weights) and len(weights) > 1:
        return min(weights)
    return dominant
