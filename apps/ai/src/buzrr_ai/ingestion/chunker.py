"""Structure-aware chunking.

Chunk quality is the single biggest determinant of generation quality, so this
is deliberately not a fixed-size sliding window. The algorithm walks blocks in
order, maintains a **heading path stack**, and closes a chunk when either the
size budget is reached or a significant heading arrives.

Every chunk therefore carries `heading_path` and a page range — which is what
makes "Unit 4, Subsection 2" answerable via a metadata prefilter, and what
citations are rendered from.
"""

from dataclasses import dataclass, field

from buzrr_ai.ingestion.parsers.base import Block

# Headings at or above this level force a chunk boundary regardless of size: a
# chunk must never straddle two top-level sections, or its heading path is a lie.
_HARD_BOUNDARY_LEVEL = 2


@dataclass(slots=True)
class TextChunk:
    text: str
    token_count: int
    page_start: int | None
    page_end: int | None
    heading_path: list[str] = field(default_factory=list)


def estimate_tokens(text: str) -> int:
    """Cheap token estimate.

    Deliberately not a real tokenizer: pulling in tiktoken/sentencepiece for a
    size budget would add a heavy dependency for a number that only needs to be
    roughly right. ~4 characters per token is the usual English approximation,
    and the caller keeps a wide margin under the model's 2048-token input cap.
    """
    return max(1, len(text) // 4)


class _Accumulator:
    def __init__(self) -> None:
        self.lines: list[str] = []
        self.tokens = 0
        self.page_start: int | None = None
        self.page_end: int | None = None

    def add(self, text: str, tokens: int, page: int) -> None:
        self.lines.append(text)
        self.tokens += tokens
        if page:
            self.page_start = page if self.page_start is None else min(self.page_start, page)
            self.page_end = page if self.page_end is None else max(self.page_end, page)

    @property
    def empty(self) -> bool:
        return not self.lines


def chunk_blocks(
    blocks: list[Block],
    *,
    target_tokens: int = 800,
    max_tokens: int = 1800,
    overlap_tokens: int = 120,
) -> list[TextChunk]:
    chunks: list[TextChunk] = []
    heading_stack: list[tuple[int, str]] = []
    acc = _Accumulator()
    carry: list[str] = []  # overlap tail from the previous chunk

    def current_path() -> list[str]:
        return [title for _, title in heading_stack]

    def flush(path: list[str]) -> None:
        nonlocal acc, carry
        if acc.empty:
            return
        text = "\n".join(acc.lines).strip()
        if text:
            chunks.append(
                TextChunk(
                    text=text,
                    token_count=estimate_tokens(text),
                    page_start=acc.page_start,
                    page_end=acc.page_end,
                    heading_path=list(path),
                )
            )
            carry = _overlap_tail(acc.lines, overlap_tokens)
        acc = _Accumulator()

    for block in blocks:
        if block.heading_level > 0:
            level = block.heading_level
            # A heading at level <= 2 always ends the current chunk; deeper ones
            # only do so if the chunk already has real content, which keeps
            # tightly-nested subsections from producing one-line chunks.
            if level <= _HARD_BOUNDARY_LEVEL or acc.tokens >= target_tokens // 2:
                flush(current_path())
                carry = []  # a new section should not inherit the previous one's tail

            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_stack.append((level, block.text))

            # The heading itself leads the next chunk — it is strong retrieval
            # signal and reads correctly in a citation.
            acc.add(block.text, estimate_tokens(block.text), block.page)
            continue

        tokens = estimate_tokens(block.text)

        # A single oversized block (a wall-of-text paragraph) gets split on its
        # own rather than blowing past the embedding input cap.
        if tokens > max_tokens:
            flush(current_path())
            for piece in _split_oversized(block.text, target_tokens):
                chunks.append(
                    TextChunk(
                        text=piece,
                        token_count=estimate_tokens(piece),
                        page_start=block.page or None,
                        page_end=block.page or None,
                        heading_path=current_path(),
                    )
                )
            carry = []
            continue

        if acc.empty and carry:
            for line in carry:
                acc.add(line, estimate_tokens(line), 0)
            carry = []

        if acc.tokens + tokens > max_tokens:
            flush(current_path())
            if carry:
                for line in carry:
                    acc.add(line, estimate_tokens(line), 0)
                carry = []

        acc.add(block.text, tokens, block.page)

        if acc.tokens >= target_tokens:
            flush(current_path())

    flush(current_path())
    return [c for c in chunks if c.text.strip()]


def _overlap_tail(lines: list[str], overlap_tokens: int) -> list[str]:
    """Trailing lines worth ~`overlap_tokens`, so context isn't cut mid-idea."""
    if overlap_tokens <= 0:
        return []
    tail: list[str] = []
    budget = overlap_tokens
    for line in reversed(lines):
        cost = estimate_tokens(line)
        if cost > budget:
            break
        tail.insert(0, line)
        budget -= cost
    return tail


def _split_oversized(text: str, target_tokens: int) -> list[str]:
    """Sentence-boundary split for a paragraph larger than the whole budget."""
    sentences = _split_sentences(text)
    pieces: list[str] = []
    buffer: list[str] = []
    tokens = 0
    for sentence in sentences:
        cost = estimate_tokens(sentence)
        if buffer and tokens + cost > target_tokens:
            pieces.append(" ".join(buffer))
            buffer, tokens = [], 0
        buffer.append(sentence)
        tokens += cost
    if buffer:
        pieces.append(" ".join(buffer))
    return pieces or [text]


def _split_sentences(text: str) -> list[str]:
    out: list[str] = []
    current: list[str] = []
    for token in text.split(" "):
        current.append(token)
        if token.endswith((".", "!", "?", ";")) and len(token) > 1:
            out.append(" ".join(current))
            current = []
    if current:
        out.append(" ".join(current))
    return out
