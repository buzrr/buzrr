"""Building the context block handed to the model.

Excerpts are labelled `[S1]`, `[S2]`, … and the model is asked to cite those
labels. Mapping short labels back to chunk ids on our side is far more reliable
than asking a model to echo UUIDs verbatim — and it means a hallucinated label
simply fails to resolve instead of producing a bogus citation.
"""

from dataclasses import dataclass

from buzrr_ai.rag.retriever import RetrievedChunk

# Leaves ample headroom under the model's context window for the system prompt,
# the instructions and the JSON response.
_DEFAULT_BUDGET_CHARS = 60_000


@dataclass(slots=True)
class BuiltContext:
    text: str
    by_label: dict[str, RetrievedChunk]


def build_context(
    chunks: list[RetrievedChunk], *, budget_chars: int = _DEFAULT_BUDGET_CHARS
) -> BuiltContext:
    parts: list[str] = []
    by_label: dict[str, RetrievedChunk] = {}
    used = 0

    for index, chunk in enumerate(chunks, start=1):
        label = f"S{index}"
        header = _describe(chunk)
        body = f"[{label}] {header}\n{chunk.text}"
        if used + len(body) > budget_chars and parts:
            break
        parts.append(body)
        by_label[label] = chunk
        used += len(body)

    return BuiltContext(text="\n\n---\n\n".join(parts), by_label=by_label)


def _describe(chunk: RetrievedChunk) -> str:
    bits = [f"source: {chunk.document_name}"]
    if chunk.heading_path:
        bits.append("section: " + " > ".join(chunk.heading_path))
    if chunk.page_start:
        pages = (
            f"p.{chunk.page_start}"
            if not chunk.page_end or chunk.page_end == chunk.page_start
            else f"pp.{chunk.page_start}-{chunk.page_end}"
        )
        bits.append(pages)
    return "(" + "; ".join(bits) + ")"
