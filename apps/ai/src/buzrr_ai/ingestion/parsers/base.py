"""The one shape every parser produces."""

from dataclasses import dataclass, field


@dataclass(slots=True)
class Block:
    """A run of text with its position in the document.

    `heading_level` is 0 for body text and 1..6 for a heading. That level is what
    lets the chunker maintain a heading path — which is in turn what makes
    "Unit 4, Subsection 2" answerable and what citations are built from.
    """

    text: str
    page: int
    heading_level: int = 0


@dataclass(slots=True)
class ParsedDocument:
    blocks: list[Block] = field(default_factory=list)
    page_count: int | None = None
