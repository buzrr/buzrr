# Buzrr-AI

Knowledge Spaces, document ingestion and RAG quiz generation for Buzrr.
Python 3.12 + FastAPI, with an [arq](https://arq-docs.helpmanual.io/) worker for
ingestion.

See [docs/architecture/ai.md](../../docs/architecture/ai.md) for the design and
[ADR-009](../../docs/adr/009-buzrr-ai-rag-service.md) for why it exists.

## First run

```bash
docker compose up -d postgres redis     # from the repo root
yarn workspace ai setup                 # creates .venv and installs deps
cp apps/ai/.env.example apps/ai/.env    # then fill in BETTER_AUTH_SECRET + GEMINI_API_KEY
yarn workspace ai migrate:deploy        # applies the `ai` schema
```

`BETTER_AUTH_SECRET` **must** match `apps/web` and `apps/server` — this service
verifies the same JWT the Nest server does. `yarn setup` at the repo root keeps
all three in sync.

## Running

```bash
yarn workspace ai dev        # API on :3002
yarn workspace ai worker     # ingestion worker (separate terminal)
```

Or via Docker, without a Python toolchain on the host:

```bash
docker compose --profile ai up -d
```

## Checks

```bash
yarn workspace ai lint
yarn workspace ai check-types
yarn workspace ai test
```

Integration tests need Postgres with pgvector (`docker compose up -d postgres`)
and skip cleanly when none is reachable. No test ever calls Gemini — both
providers are faked behind their protocols.

## Layout

| Path                       | What                                                     |
| -------------------------- | -------------------------------------------------------- |
| `src/buzrr_ai/api/`        | HTTP routers (`/api/ai/*`)                               |
| `src/buzrr_ai/auth.py`     | Verifies the shared HS256 JWT; rejects `typ: "player"`   |
| `src/buzrr_ai/db/`         | SQLAlchemy models + repositories (tenant-scoped)         |
| `src/buzrr_ai/ingestion/`  | Parsers, cleaner, chunker, pipeline, temp-file lifecycle |
| `src/buzrr_ai/rag/`        | Query planner, retriever, MMR, context builder           |
| `src/buzrr_ai/generation/` | Structured-output schemas, prompts, orchestration        |
| `src/buzrr_ai/providers/`  | `EmbeddingProvider` / `LLMProvider` + Gemini impls       |
| `src/buzrr_ai/worker.py`   | arq worker and the hourly sweep                          |
| `alembic/`                 | Migrations for the `ai` schema only                      |
