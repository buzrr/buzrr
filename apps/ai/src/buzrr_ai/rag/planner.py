"""Turning a natural-language ask into a retrieval plan.

Requests arrive in two shapes and they need opposite handling:

  * *"Generate questions for the topic third law of motion"* — a **topic**. The
    words describe the content, so embedding them finds it.
  * *"Generate questions for Unit 4, Subsection 2"* — a **locator**. "Unit 4"
    says nothing about what Unit 4 contains, and its embedding looks nothing
    like that content, so it has to become a metadata prefilter instead.

Telling them apart is this module's whole job: one small structured call splits
the request into the part worth embedding and the part worth filtering on, and
mixing them up is the difference between finding the right pages and finding
every page that happens to say "unit".
"""

from pydantic import BaseModel, Field

from buzrr_ai.generation.schemas import QuestionType
from buzrr_ai.providers.base import LLMProvider

_SYSTEM = """You turn a user's request about their own study documents into a retrieval plan.
You never answer the request itself. Extract only what the user actually said —
do not invent a section filter that was not mentioned. A topic is what the
material is about; a section filter is where it sits in the document. When the
user names a subject rather than a part of the document, the section filter
stays empty."""

_PROMPT = """User request:
\"\"\"{prompt}\"\"\"

Headings available in this knowledge space (may be truncated):
{headings}

Produce the retrieval plan."""


class RetrievalPlan(BaseModel):
    search_query: str = Field(
        description=(
            "The topical part of the request, phrased as a search query. Strip "
            "instructions like 'generate 10 MCQs' and framing like 'for the "
            "topic'; keep the subject itself — 'Generate questions for the "
            "topic third law of motion' gives 'third law of motion'. If the "
            "user named only a section, use that section's title as the query."
        )
    )
    section_filter: list[str] = Field(
        default_factory=list,
        description=(
            "Literal heading fragments the user named, e.g. ['Unit 4', "
            "'Subsection 2'] — structural locators only. A subject the user "
            "described as a topic is never a section filter: it belongs in "
            "search_query. Empty when the user did not scope to a section."
        ),
    )
    question_count: int = Field(default=5, ge=1, le=30)
    question_types: list[QuestionType] = Field(default_factory=lambda: [QuestionType.MCQ])
    difficulty: str = Field(default="mixed", description="one of: easy, medium, hard, mixed")


async def plan_retrieval(
    llm: LLMProvider,
    *,
    prompt: str,
    headings: list[str],
    requested_types: list[QuestionType] | None,
    requested_count: int | None,
) -> RetrievalPlan:
    sample = "\n".join(f"- {h}" for h in headings[:120]) or "- (none recorded)"
    plan = await llm.structured(
        system=_SYSTEM,
        prompt=_PROMPT.format(prompt=prompt.strip(), headings=sample),
        schema=RetrievalPlan,
        temperature=0.0,
    )

    # Explicit UI controls always beat what the model inferred from prose.
    if requested_count is not None:
        plan.question_count = requested_count
    if requested_types:
        plan.question_types = requested_types
    if not plan.question_types:
        plan.question_types = [QuestionType.MCQ]
    if not plan.search_query.strip():
        plan.search_query = prompt.strip()
    return plan
