"""Plain text and Markdown.

`.md` gets ATX (`#`) and Setext (`===` / `---`) heading detection; `.txt` goes
through the same path and simply finds no headings, which is the correct
outcome rather than a special case.
"""

import re
from pathlib import Path

from buzrr_ai.ingestion.parsers.base import Block, ParsedDocument

_ATX = re.compile(r"^(#{1,6})\s+(.*\S)\s*$")
_SETEXT_H1 = re.compile(r"^=+\s*$")
_SETEXT_H2 = re.compile(r"^-{2,}\s*$")
_FENCE = re.compile(r"^\s*(```|~~~)")


def parse_markdown(path: Path) -> ParsedDocument:
    raw = path.read_text(encoding="utf-8", errors="replace")
    lines = raw.splitlines()
    blocks: list[Block] = []
    in_fence = False

    index = 0
    while index < len(lines):
        line = lines[index]

        if _FENCE.match(line):
            in_fence = not in_fence
            blocks.append(Block(text=line.rstrip(), page=0))
            index += 1
            continue

        if in_fence:
            blocks.append(Block(text=line.rstrip(), page=0))
            index += 1
            continue

        stripped = line.strip()
        if not stripped:
            index += 1
            continue

        if match := _ATX.match(line):
            blocks.append(
                Block(text=match.group(2).strip(), page=0, heading_level=len(match.group(1)))
            )
            index += 1
            continue

        # Setext: the underline is on the *next* line.
        nxt = lines[index + 1] if index + 1 < len(lines) else ""
        if nxt and _SETEXT_H1.match(nxt):
            blocks.append(Block(text=stripped, page=0, heading_level=1))
            index += 2
            continue
        if nxt and _SETEXT_H2.match(nxt):
            blocks.append(Block(text=stripped, page=0, heading_level=2))
            index += 2
            continue

        blocks.append(Block(text=stripped, page=0))
        index += 1

    return ParsedDocument(blocks=blocks, page_count=None)
