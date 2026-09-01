"""Maximal Marginal Relevance.

Plain top-k is wrong for question generation: the ten nearest chunks to "second
law of thermodynamics" are often ten restatements of the same paragraph, and the
model then writes ten near-duplicate questions. MMR trades a little relevance
for coverage, so a 10-question request draws on the whole section.
"""

from collections.abc import Sequence


def _dot(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=False))


def mmr_select(
    *,
    query: Sequence[float],
    candidates: Sequence[Sequence[float]],
    k: int,
    lambda_mult: float = 0.6,
) -> list[int]:
    """Indices of the selected candidates, best first.

    Vectors are unit-length (the embedding provider normalises after MRL
    truncation), so a dot product *is* cosine similarity — no division needed.
    """
    if not candidates or k <= 0:
        return []
    k = min(k, len(candidates))

    relevance = [_dot(query, c) for c in candidates]
    selected: list[int] = [max(range(len(candidates)), key=relevance.__getitem__)]

    while len(selected) < k:
        best_index, best_score = -1, float("-inf")
        for index in range(len(candidates)):
            if index in selected:
                continue
            redundancy = max(_dot(candidates[index], candidates[s]) for s in selected)
            score = lambda_mult * relevance[index] - (1 - lambda_mult) * redundancy
            if score > best_score:
                best_index, best_score = index, score
        if best_index < 0:  # pragma: no cover — defensive
            break
        selected.append(best_index)

    return selected
