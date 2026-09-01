"""Provider protocols.

Everything model-specific sits behind these two interfaces so the rest of the
service never imports a vendor SDK. Swapping Gemini for another provider — or
faking both in tests, which is how the whole test suite avoids network calls —
means implementing these and nothing else.
"""

from typing import Protocol, TypeVar

from pydantic import BaseModel

TModel = TypeVar("TModel", bound=BaseModel)


class EmbeddingProvider(Protocol):
    @property
    def model(self) -> str: ...

    @property
    def dimensions(self) -> int: ...

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed chunks for storage."""
        ...

    async def embed_query(self, text: str) -> list[float]:
        """Embed a search query.

        Separate from `embed_documents` because Gemini takes a `task_type` that
        differs between the two, and asymmetric embedding measurably improves
        retrieval.
        """
        ...


class LLMProvider(Protocol):
    @property
    def model(self) -> str: ...

    async def structured(
        self,
        *,
        system: str,
        prompt: str,
        schema: type[TModel],
        temperature: float = 0.4,
    ) -> TModel:
        """Return a validated instance of `schema`.

        Structured output is non-negotiable here — the existing Nest AI path
        parses a hand-specified text layout with `split("\\n\\n")` and silently
        drops anything malformed (docs/CONTEXT.md debt #6). This service asks the
        model for JSON matching a real schema instead.
        """
        ...
