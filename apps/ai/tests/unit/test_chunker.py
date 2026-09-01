"""Chunker behaviour.

Chunk quality decides generation quality, so these lock in the properties the
retrieval layer depends on: heading paths are correct, chunks never straddle a
top-level section, page ranges are tracked, and nothing exceeds the embedding
input cap.
"""

from buzrr_ai.ingestion.chunker import chunk_blocks, estimate_tokens
from buzrr_ai.ingestion.parsers.base import Block


def _body(text: str, page: int = 1, repeat: int = 1) -> Block:
    return Block(text=(text + " ") * repeat, page=page)


def _doc() -> list[Block]:
    return [
        Block("Unit 4: Thermodynamics", 1, 1),
        _body("Thermodynamics studies energy transformations.", 1, 12),
        Block("Subsection 1: First Law", 1, 2),
        _body("Energy cannot be created or destroyed.", 2, 30),
        Block("Subsection 2: Second Law", 3, 2),
        _body("Entropy of an isolated system never decreases.", 3, 30),
        Block("Unit 5: Kinetics", 5, 1),
        _body("Reaction rates depend on temperature.", 5, 10),
    ]


def test_every_chunk_carries_a_heading_path() -> None:
    chunks = chunk_blocks(_doc(), target_tokens=200, max_tokens=400, overlap_tokens=30)
    assert chunks
    assert all(c.heading_path for c in chunks)


def test_no_chunk_straddles_two_top_level_sections() -> None:
    chunks = chunk_blocks(_doc(), target_tokens=200, max_tokens=400, overlap_tokens=30)
    for chunk in chunks:
        units = [h for h in chunk.heading_path if h.startswith("Unit ")]
        assert len(units) <= 1, f"chunk spans {units}"
    # And the Unit 5 content never carries a Unit 4 path.
    kinetics = [c for c in chunks if "Reaction rates" in c.text]
    assert kinetics
    assert all(c.heading_path[0] == "Unit 5: Kinetics" for c in kinetics)


def test_subsection_is_nested_under_its_unit() -> None:
    chunks = chunk_blocks(_doc(), target_tokens=200, max_tokens=400, overlap_tokens=30)
    second_law = [c for c in chunks if "Entropy" in c.text]
    assert second_law
    assert second_law[0].heading_path == [
        "Unit 4: Thermodynamics",
        "Subsection 2: Second Law",
    ]


def test_page_range_is_tracked() -> None:
    chunks = chunk_blocks(_doc(), target_tokens=200, max_tokens=400, overlap_tokens=30)
    entropy = next(c for c in chunks if "Entropy" in c.text)
    assert entropy.page_start == 3
    assert entropy.page_end is not None and entropy.page_end >= 3


def test_never_exceeds_the_max_token_budget() -> None:
    # The embedding provider caps input at 2048 tokens; exceeding it is a hard
    # failure at ingestion time, not a quality issue.
    chunks = chunk_blocks(_doc(), target_tokens=200, max_tokens=400, overlap_tokens=30)
    assert all(c.token_count <= 400 * 1.2 for c in chunks)


def test_oversized_single_paragraph_is_split() -> None:
    giant = Block("This is a sentence about entropy. " * 400, 1)
    chunks = chunk_blocks([Block("Section", 1, 1), giant], target_tokens=200, max_tokens=400)
    assert len(chunks) > 1
    assert all(c.token_count <= 400 * 1.2 for c in chunks)


def test_oversized_paragraph_without_sentence_punctuation_is_still_split() -> None:
    # Converted PDFs and OCR output produce long runs with no `.!?;` at all.
    # Sentence splitting cannot help there, so the cap must still hold.
    giant = Block("entropy " * 2000, 1)
    chunks = chunk_blocks([Block("Section", 1, 1), giant], target_tokens=200, max_tokens=400)
    assert len(chunks) > 1
    assert all(c.token_count <= 400 * 1.2 for c in chunks)


def test_empty_input_yields_no_chunks() -> None:
    assert chunk_blocks([]) == []


def test_headings_only_still_produce_a_chunk() -> None:
    chunks = chunk_blocks([Block("Only A Heading", 1, 1)])
    assert len(chunks) == 1
    assert chunks[0].heading_path == ["Only A Heading"]


def test_deeper_heading_replaces_same_level_sibling() -> None:
    blocks = [
        Block("Chapter 1", 1, 1),
        Block("Part A", 1, 3),
        _body("alpha content here", 1, 40),
        Block("Part B", 2, 3),
        _body("beta content here", 2, 40),
    ]
    chunks = chunk_blocks(blocks, target_tokens=100, max_tokens=250)
    beta = next(c for c in chunks if "beta" in c.text)
    assert beta.heading_path == ["Chapter 1", "Part B"]
    assert "Part A" not in beta.heading_path


def test_token_estimate_is_monotonic() -> None:
    assert estimate_tokens("a") <= estimate_tokens("a b c d e f g h")
