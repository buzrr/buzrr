"""Prompt text, kept out of the service code so it can be reviewed and diffed
without reading control flow."""

from buzrr_ai.generation.schemas import QuestionType

SYSTEM = """You write quiz questions for Buzrr from a user's own study documents.

Absolute rules:
1. Ground every question in the provided context excerpts. Never use outside
   knowledge, and never invent facts that are not in the excerpts.
2. Each question must be answerable from the excerpts alone.
3. Questions must be self-contained. Never write "according to the passage",
   "in the text above", or "as shown in the figure" — the player will not see
   the source material.
4. Cite your sources: put the labels of the excerpts you used (e.g. "S3") in
   `source_refs`. Use only labels that appear in the context.
5. Distractors must be plausible and clearly wrong to someone who knows the
   material. Never use "all of the above", "none of the above", or joke options.
6. Do not repeat the same fact across questions. Spread coverage across the
   excerpts you were given.
7. If the excerpts do not contain enough material for the number of questions
   requested, return fewer good questions rather than padding with weak ones."""

_TYPE_GUIDANCE = {
    QuestionType.MCQ: (
        "MCQ: exactly 4 options, exactly one correct. Keep options similar in "
        "length and grammatical form so the answer is not guessable from shape."
    ),
    QuestionType.TRUE_FALSE: (
        "TRUE_FALSE: `stem` is a single declarative statement and `answer` says "
        "whether it is true. Avoid statements that are trivially true; a good "
        "false statement is a plausible misconception."
    ),
}

_TEMPLATE = """The user asked:
\"\"\"{prompt}\"\"\"

Generate {count} question(s).
Allowed question types: {types}
{type_guidance}
Target difficulty: {difficulty}

Context excerpts from the user's documents:
{context}

Write the questions now."""


def build_generation_prompt(
    *,
    user_prompt: str,
    count: int,
    types: list[QuestionType],
    difficulty: str,
    context: str,
) -> str:
    guidance = "\n".join(f"- {_TYPE_GUIDANCE[t]}" for t in types if t in _TYPE_GUIDANCE)
    return _TEMPLATE.format(
        prompt=user_prompt.strip(),
        count=count,
        types=", ".join(t.value for t in types),
        type_guidance=guidance,
        difficulty=difficulty,
        context=context,
    )
