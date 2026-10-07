# ADR-014: Self-hosting with no SaaS lock-in

**Status:** Accepted

## Context

Running Buzrr required accounts at Google (OAuth — the only sign-in),
Cloudinary (the only image store) and Google AI Studio (the only model), and
there was no way to run the apps themselves in Docker. The Phase 0 goal is an
install that runs fully offline on a school server — something hosted
competitors can't offer — without changing how the hosted service runs.

## Decision

1. **Storage behind `MediaStorage`** (`apps/server/src/common/storage/`):
   `cloudinary`, `s3` (any S3-compatible store — a dependency-free SigV4
   signer, checked against AWS's published test vector) and `local` (the
   API's disk, served at `/uploads`). Picked by `STORAGE_DRIVER`; unset keeps
   Cloudinary when its credentials exist, else local. Drivers that serve
   bytes as-is accept only magic-byte-sniffed raster images (no SVG/HTML).
2. **Models behind `TextGenerator`** (Nest) and the existing provider
   protocols (`apps/ai`): Gemini, or any server speaking the OpenAI
   chat-completions/embeddings API (Ollama, vLLM, LM Studio, OpenAI, …),
   picked by `LLM_PROVIDER` / `LLM_BASE_URL`. Plain HTTP — no vendor SDK on
   that path.
3. **Local accounts**: Better Auth email + password behind
   `AUTH_EMAIL_PASSWORD=ON` (`AUTH_EMAIL_SIGNUP=OFF` closes registration).
   Google becomes optional. No email verification or reset — an offline
   server has no mail.
4. **`docker compose up` runs everything**: Postgres, Redis, a one-shot
   `migrate`, the API and the web app from new Dockerfiles; `--profile ai`
   adds Buzrr-AI (with its Alembic migration) and `--profile ollama` a local
   model server. An auth secret is generated into a volume on first boot.
   `yarn setup` now starts only `postgres redis` from the same file.
5. **Fresh databases are baselined.** The committed migration history can't
   build an empty database (it starts with an `ALTER TABLE users`), so
   `packages/prisma/scripts/deploy.mjs` creates the schema with `db push`
   and marks every migration applied when no history exists, then runs
   `migrate deploy`. Databases with history (hosted production) take the
   plain `migrate deploy` path.

Defaults keep the hosted deployment unchanged: Cloudinary and Gemini stay
selected by their existing env vars, and Google stays on while its
credentials are set.

## Consequences

- CI boots the stack with no config (`self-host` job) and smoke-tests it.
- MinIO no longer publishes pullable images, so none is bundled; S3 support
  was verified against SeaweedFS. Local disk is the offline default.
- The web image compiles `PUBLIC_API_URL` in; changing it means a rebuild.
- Images are not slim (the API image keeps dev deps for the Prisma CLI).
- A Helm chart is future work.

## Evidence

`docker-compose.yml`, `apps/server/Dockerfile`, `apps/web/Dockerfile`,
`apps/server/src/common/{storage,llm}/`, `apps/ai/src/buzrr_ai/providers/`,
`apps/web/src/lib/auth-methods.ts`, `packages/prisma/scripts/deploy.mjs`,
`docs/self-hosting.md`.
