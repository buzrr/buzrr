# ADR-009: A separate Python service for document RAG (Buzrr-AI)

**Status:** Accepted

## Context

Buzrr's only AI feature was `POST /api/quizzes/ai`: roughly 75 lines inside
`QuizzesService.createWithAi` that send a topic description to Gemini, receive
**plain text in a hand-specified layout**, and parse it with `split("\n\n")`.
`docs/CONTEXT.md` ranked the fragility of that parser as known debt #6 — any
change in how the model formats its answer silently breaks quiz creation.

The new requirement is different in kind, not degree: users upload their own
source material (PDF/DOCX/TXT/Markdown), the system indexes it, and questions are
generated **from that material**, with citations back to document, page and
section. That needs document parsing, chunking, embeddings, vector search and
background processing — none of which existed anywhere in the repo.

Three properties of the existing system constrained the answer:

- The Nest server owns the realtime game loop (ADR-002). Its process holds
  Socket.IO connections and in-process timers, and the engine is written to be
  safe across N instances (ADR-004). CPU-bound PDF parsing on that event loop is
  exactly the kind of work that would make a question timer fire late.
- Postgres and Redis are already provisioned and already shared.
- The web↔server trust chain is a single shared secret (ADR-003), so a third
  verifier costs nothing to add.

## Decision

Add **`apps/ai`** — Python 3.12 + FastAPI, with an [arq](https://arq-docs.helpmanual.io/)
worker — as a fourth deployable unit.

1. **Python, because of the ecosystem.** Layout-aware PDF parsing (PyMuPDF, which
   exposes per-span font size and weight — the only signal available for
   detecting headings in a PDF) and DOCX structure extraction have no comparable
   Node equivalent. Heading detection is what makes "Unit 4, Subsection 2"
   answerable at all.
2. **A separate process, because of the game loop.** Ingestion cannot share an
   event loop with the engine. Out-of-process means AI load can never stall a
   live game, and the AI service can be restarted independently.
3. **The same Postgres, a schema it owns.** `ai.*`, migrated by Alembic, with
   pgvector. **No foreign keys into `public.users`** — `user_id` is a plain text
   column populated from the JWT `sub`. That is what keeps the two migration
   tools independent: Alembic never touches `public`, Prisma never touches `ai`.
4. **The same Redis, a prefix it owns.** All keys under `ai:` — no overlap with
   `game:*`, `games:deadlines`, `mm:duel:*` or `duel:invite:*`.
5. **The same JWT.** FastAPI verifies the identical HS256 `BETTER_AUTH_SECRET`
   token the Nest server verifies, and rejects `typ: "player"` (invariant #12).
   No new identity, no new secret, no new login.
6. **The browser calls it directly** (`NEXT_PUBLIC_AI_API_URL`) rather than
   through a Nest proxy: uploads are multi-MB multipart and generation wants
   streaming, so proxying would add a moving part on the two heaviest paths for
   no auth benefit.
7. **Quiz writes stay in Nest.** Generated questions are exported through a new
   `POST /api/quizzes/import`, so quiz ownership, question `order` and the
   `moderationStatus` default keep living in one place (ADR-007). The AI service
   never writes to `public`.
8. **Structured output, not text parsing.** Gemini is given a Pydantic model as a
   `response_schema`. This is the direct fix for debt #6, applied to the new code
   rather than retrofitted to the old.

## Consequences

- A third service to deploy, configure and monitor. It is deliberately
  **optional**: with `NEXT_PUBLIC_AI_API_URL` unset the sidebar entry disappears
  and web+server behave exactly as before, so contributor onboarding
  (`yarn setup`, `yarn dev`) is unchanged and needs no Python toolchain.
- **Postgres must provide pgvector.** `docker-compose.yml` and the CI service
  container moved from `postgres:16-alpine` to `pgvector/pgvector:pg16`. A
  managed Postgres that cannot install the extension blocks this design.
- **Redis becomes load-bearing for a second subsystem.** It was already a single
  point of failure for realtime (CONTEXT.md debt #2); an outage now degrades two
  features. Acceptable because ingestion is asynchronous and retryable.
- **Two migration tools on one database.** Safe only while the schema boundary
  holds — this is now invariant #30.
- **User document text is sent to Google.** The same trust boundary Gemini quiz
  generation already crossed, but with user-uploaded material rather than a
  one-line prompt. Surfaced in the upload UI copy.
- **Cost becomes user-driven.** A 500-page PDF is thousands of embedding calls,
  so per-user upload and generation limits are enforced in-service.
- `apps/ai` is the first component in this repo with a Dockerfile, and the first
  with **any automated tests** — CI previously ran lint+typecheck+build only.

## Alternatives considered

- **A Nest module using a Node PDF library.** Rejected: no Node parser exposes
  the typography needed for heading detection, and it would put CPU-bound work on
  the game loop's process.
- **Adding the AI models to `schema.prisma`.** Rejected: Prisma 7 has no
  first-class vector type (it would need `Unsupported()` plus raw SQL for every
  similarity query), and the Python service would then be reading tables it does
  not own.
- **A separate database.** Rejected: harder isolation than the problem needs, at
  the cost of a second instance and a heavier local setup.
- **Proxying through Nest.** Rejected: see decision 6.

## Evidence

`apps/ai/` · `apps/ai/alembic/versions/0001_initial_ai_schema.py` ·
`apps/server/src/modules/quizzes/quizzes.service.ts` (`importQuestions`) ·
`apps/web/src/lib/api/ai-client.ts` · `docs/architecture/ai.md`
