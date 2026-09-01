"""Markdown and DOCX parsing (PDF is covered in the integration fixture test)."""

from pathlib import Path

from buzrr_ai.ingestion.parsers import SUPPORTED_EXTENSIONS, parse
from buzrr_ai.ingestion.parsers.text import parse_markdown

MARKDOWN = """# Unit 4

Intro paragraph.

## Subsection 2

Body text here.

Setext Heading
==============

More body.

```python
# this hash is code, not a heading
x = 1
```
"""


def test_markdown_atx_headings(tmp_path: Path) -> None:
    path = tmp_path / "notes.md"
    path.write_text(MARKDOWN)
    blocks = parse_markdown(path).blocks
    levels = {b.text: b.heading_level for b in blocks}
    assert levels["Unit 4"] == 1
    assert levels["Subsection 2"] == 2
    assert levels["Intro paragraph."] == 0


def test_markdown_setext_heading(tmp_path: Path) -> None:
    path = tmp_path / "notes.md"
    path.write_text(MARKDOWN)
    blocks = parse_markdown(path).blocks
    assert any(b.text == "Setext Heading" and b.heading_level == 1 for b in blocks)


def test_hash_inside_a_code_fence_is_not_a_heading(tmp_path: Path) -> None:
    path = tmp_path / "notes.md"
    path.write_text(MARKDOWN)
    blocks = parse_markdown(path).blocks
    code_line = next(b for b in blocks if "not a heading" in b.text)
    assert code_line.heading_level == 0


def test_plain_text_finds_no_headings(tmp_path: Path) -> None:
    path = tmp_path / "notes.txt"
    path.write_text("Just a line.\nAnd another.\n")
    blocks = parse(path, ".txt").blocks
    assert [b.heading_level for b in blocks] == [0, 0]


def test_supported_extensions() -> None:
    assert {".pdf", ".docx", ".txt", ".md"} == SUPPORTED_EXTENSIONS
