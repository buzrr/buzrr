"""Deterministic stand-ins for the two provider protocols.

No test in this suite ever calls Gemini: embeddings are hash-derived (stable
across runs, so retrieval assertions are meaningful) and generation returns
canned structured objects.
"""

import hashlib
import math
from typing import Any, TypeVar

from pydantic import BaseModel

TModel = TypeVar("TModel", bound=BaseModel)

DIM = 768


def _hash_vector(text: str, dim: int = DIM) -> list[float]:
    """A stable pseudo-embedding.

    Tokens drive the components, so two texts sharing words land near each other
    — enough structure for retrieval ordering to be testable.
    """
    vector = [0.0] * dim
    for token in text.lower().split():
        digest = hashlib.sha256(token.encode()).digest()
        for i in range(0, 32, 4):
            index = int.from_bytes(digest[i : i + 2], "big") % dim
            weight = (digest[i + 2] / 255.0) - 0.5
            vector[index] += weight
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        vector[0] = 1.0
        return vector
    return [v / norm for v in vector]


class FakeEmbeddings:
    def __init__(self, dim: int = DIM) -> None:
        self._dim = dim
        self.document_calls: list[list[str]] = []
        self.query_calls: list[str] = []

    @property
    def model(self) -> str:
        return "fake-embedding"

    @property
    def dimensions(self) -> int:
        return self._dim

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.document_calls.append(list(texts))
        return [_hash_vector(t, self._dim) for t in texts]

    async def embed_query(self, text: str) -> list[float]:
        self.query_calls.append(text)
        return _hash_vector(text, self._dim)


class FakeLLM:
    """Returns queued responses in order; asserts it wasn't called unexpectedly."""

    def __init__(self, responses: list[Any] | None = None) -> None:
        self.responses = list(responses or [])
        self.prompts: list[str] = []

    @property
    def model(self) -> str:
        return "fake-llm"

    async def structured(
        self,
        *,
        system: str,
        prompt: str,
        schema: type[TModel],
        temperature: float = 0.4,
    ) -> TModel:
        self.prompts.append(prompt)
        if not self.responses:
            raise AssertionError(f"FakeLLM had no queued response for {schema.__name__}")
        response = self.responses.pop(0)
        if not isinstance(response, schema):
            raise AssertionError(
                f"FakeLLM queued a {type(response).__name__} but was asked for {schema.__name__}"
            )
        return response
