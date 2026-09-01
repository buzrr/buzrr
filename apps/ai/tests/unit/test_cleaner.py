"""Normalisation and running header/footer removal."""

from buzrr_ai.ingestion.cleaner import clean_blocks, normalize
from buzrr_ai.ingestion.parsers.base import Block


def test_rejoins_words_split_across_a_line_break() -> None:
    assert normalize("thermo-\ndynamics") == "thermodynamics"


def test_collapses_whitespace_and_normalizes_unicode() -> None:
    assert normalize("a   b") == "a b"


def test_normalizes_bullet_glyphs() -> None:
    assert normalize("• first point") == "- first point"


def test_strips_running_headers_repeated_across_pages() -> None:
    blocks = [Block("CHEM 101 Course Notes", page) for page in range(1, 11)]
    blocks += [Block(f"Real content on page {page}", page) for page in range(1, 11)]
    cleaned = clean_blocks(blocks, page_count=10)
    assert not any("Course Notes" in b.text for b in cleaned)
    assert len([b for b in cleaned if "Real content" in b.text]) == 10


def test_keeps_repeated_text_in_a_short_document() -> None:
    # With only 3 pages there isn't enough evidence to call something a header.
    blocks = [Block("Chapter Title", page) for page in (1, 2, 3)]
    cleaned = clean_blocks(blocks, page_count=3)
    assert len(cleaned) == 3


def test_drops_bare_page_numbers() -> None:
    blocks = [Block("12", 12), Block("Page 12", 12), Block("Actual text", 12)]
    cleaned = clean_blocks(blocks, page_count=None)
    assert [b.text for b in cleaned] == ["Actual text"]


def test_drops_empty_blocks() -> None:
    assert clean_blocks([Block("   ", 1), Block("real", 1)], page_count=None)[0].text == "real"


def test_preserves_heading_level() -> None:
    cleaned = clean_blocks([Block("A Heading", 1, 2)], page_count=None)
    assert cleaned[0].heading_level == 2
