# Infrastructure: local dev, environments, deployment, CI, external services

## Local development

- `yarn setup` (`scripts/setup.mjs`) — idempotent bootstrap: checks Docker,
  writes `.env` files (never overwrites; re-adds missing required keys with
  local defaults; mints a shared `BETTER_AUTH_SECRET`), starts **only the
  `postgres` and `redis` services** of `docker-compose.yml` (the rest of that
  file is the self-hosted stack, which would take ports 3000/3001), waits for
  Postgres, `prisma db push`, `prisma generate`.
- `yarn dev` — turborepo runs `next dev` (:3000) + `nest start --watch`
  (:3001) + `tsc --watch` for `@buzrr/contract` (its `postinstall` already
  built it once). No manual step: new `apps/web/.env` files enable local
  email + password accounts; Google OAuth creds are optional.
- **Buzrr-AI is opt-in and separate**: `yarn workspace ai setup` (creates
  `apps/ai/.venv`), then `yarn workspace ai dev` (:3002) and
  `yarn workspace ai worker`. Or run just the AI containers against the host
  apps — `AI_BUZRR_API_URL=http://host.docker.internal:3001 docker compose
--profile ai up -d ai ai-worker` (they read `apps/ai/.env`) — to skip the
  host Python toolchain.
- Local Postgres is **`pgvector/pgvector:pg16`** (was `postgres:16-alpine`) so
  the `vector` extension exists. Same credentials and volume.
- Resets: `yarn docker:reset` (wipe volumes + re-setup). DB browsing:
  `yarn db:studio`.

### Exercising each mode locally (non-obvious recipes)

- **Classic room**: sign in as host in one browser, open `/player` (or the
  join link the lobby shows) in an incognito window — guests need no account.
- **Rated duel**: one signed-in account is enough — queue on `/duel` and a
  bot matches you after ~12s (`DUEL_BOTS` defaults on). Human-vs-human or
  friend invites need **two accounts in two browser profiles** (local email
  accounts are quickest).
- **Empty duel pool** ("No duel questions are available"): build then seed —
  `yarn workspace @buzrr/prisma build && yarn workspace @buzrr/prisma seed:duel`.
- **Inspect live game state**: `docker exec -it buzrr-redis redis-cli`, then
  `KEYS game:*`, `HGETALL game:<CODE>:meta`,
  `ZRANGE games:deadlines 0 -1 WITHSCORES`, `ZRANGE mm:duel:queue 0 -1 WITHSCORES`.
- **Engine rules without a browser**: `yarn workspace server test` runs the
  pure core's specs (`game-engine/core/__tests__`, no Redis needed).
- **Single app**: `yarn dev:server` / `yarn dev:web`. Server logs are Nest
  `Logger` lines on stdout (game/duel events log by gameCode).

## Environment variables (authoritative list per app)

Templates are the truth: root `.env.example`, `apps/web/.env.example`,
`apps/server/.env.example`. Summary:

| Var                                                                                                                                      | Used by                        | Required      | Notes                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` / `DIRECT_URL`                                                                                                            | both + prisma CLI              | ✅            | pg driver adapter; root `.env` feeds the Prisma CLI (`prisma.config.ts` reads `DIRECT_URL`).                                                  |
| `BETTER_AUTH_SECRET`                                                                                                                     | both                           | ✅            | **Must match across web and server** — the whole trust chain ([auth.md](auth.md)).                                                            |
| `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`                                                                                                     | web                            | ✅            | Better Auth base + allowed origins.                                                                                                           |
| `AUTH_EMAIL_PASSWORD`, `AUTH_EMAIL_SIGNUP`                                                                                               | web                            | one method ✅ | `ON` enables local email + password accounts (offline-capable); `AUTH_EMAIL_SIGNUP=OFF` closes registration. Read at request time.            |
| `GOOGLE_CLIENT_ID/SECRET`                                                                                                                | web                            | one method ✅ | Google sign-in when both set. With neither method configured, auth throws at first use.                                                       |
| `REDIS_URL`                                                                                                                              | server                         | ✅            | Server **refuses to boot** without it (`redis.module.ts`). Upstash `rediss://` supported (keepAlive tuned for it).                            |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL`                                                                                         | web (browser)                  | ✅            | Nest origin, no `/api` suffix (`lib/api/client.ts` appends it).                                                                               |
| `NEXT_PUBLIC_APP_URL`                                                                                                                    | web                            | ➖            | Public origin for join/invite links & QR (`lib/join-link.ts`); falls back to `window.location.origin`.                                        |
| `WEB_ORIGIN`                                                                                                                             | server                         | prod ✅       | CORS allow-list (comma-separated). **Unset ⇒ reflect all origins** (`parse-cors-origin.ts`) — fine locally, not in prod.                      |
| `PORT` / `API_PORT`                                                                                                                      | server                         | ➖            | `API_PORT` wins; default 3001.                                                                                                                |
| `TRUST_PROXY`                                                                                                                            | server                         | behind proxy  | Express `trust proxy` for honest `request.ip` (rate limiting).                                                                                |
| `GEMINI_API_KEY`                                                                                                                         | server                         | ➖            | Gemini for `POST /api/quizzes/ai` (the default provider).                                                                                     |
| `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`                                                                               | server (+ ai, not `LLM_MODEL`) | ➖            | OpenAI-compatible model server instead of Gemini (Ollama, vLLM, OpenAI…). `LLM_BASE_URL` alone selects it; `LLM_MODEL` required then.         |
| `STORAGE_DRIVER`                                                                                                                         | server                         | ➖            | `cloudinary` \| `s3` \| `local`. Unset ⇒ Cloudinary if `CLOUDINARY_CLOUD_NAME` is set, else local disk. Bad value/incomplete S3 ⇒ boot fails. |
| `STORAGE_LOCAL_DIR`, `STORAGE_PUBLIC_URL`                                                                                                | server                         | ➖            | Local driver: directory (default `./uploads`) and the URL browsers fetch it from (default `http://localhost:$PORT/uploads`).                  |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`                                                                                               | server                         | ➖            | Cloudinary driver.                                                                                                                            |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_REGION`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE`, `S3_PREFIX` | server                         | s3            | Any S3-compatible store; objects must be publicly readable.                                                                                   |
| `MEDIA_ORIGIN`, `NEXT_IMAGE_UNOPTIMIZED`                                                                                                 | web (build)                    | ➖            | Extra http origin allowed for `<Image>`; `1` bypasses Next's image optimizer (set by the Docker image).                                       |
| `RATELIMIT` (+`UPSTASH_REDIS_REST_URL/TOKEN`)                                                                                            | server                         | ➖            | `ON` activates per-IP limits via Upstash REST. `ON` without creds ⇒ guarded routes 503.                                                       |
| `DUEL_BOTS`                                                                                                                              | server                         | ➖            | `OFF` disables the 12s bot fallback in matchmaking.                                                                                           |
| `BILLING`                                                                                                                                | server                         | ➖            | `ON` enables Buzrr Pro. Unset ⇒ no billing and everyone gets Pro limits; `ON` without the Dodo vars ⇒ server refuses to boot.                 |
| `DODO_PAYMENTS_API_KEY`, `DODO_PRO_PRODUCT_ID`, `DODO_PAYMENTS_ENVIRONMENT`                                                              | server                         | billing       | Dodo API key, the Pro product (`pdt_…`), and `test_mode`\|`live_mode` (anything else ⇒ test).                                                 |
| `DODO_PAYMENTS_WEBHOOK_KEY`                                                                                                              | server + web (server-side)     | billing       | Webhook signing secret. **Must match on both** — each verifies the signature. Never `NEXT_PUBLIC_`.                                           |
| `APP_URL`                                                                                                                                | server                         | billing       | Public web origin for checkout `return_url`/`cancel_url` and the portal return URL.                                                           |
| `DODO_PROMO_DISCOUNT_CODE`                                                                                                               | server                         | ➖            | Dodo discount code auto-applied to checkouts and shown on `/pricing`; validated live against Dodo (dates, redemptions, product restriction).  |
| `API_INTERNAL_URL`                                                                                                                       | web (server)                   | ➖            | Private Nest origin for the webhook forwarder; falls back to `NEXT_PUBLIC_API_URL`.                                                           |
| `GITHUB_TOKEN`                                                                                                                           | web (SSR)                      | ➖            | Higher rate limits for landing-page repo stats.                                                                                               |
| `LANDING_VIDEO_URL`                                                                                                                      | web (SSR)                      | ➖            | MP4 URL for the landing-page video; unset hides it.                                                                                           |
| `NEXT_PUBLIC_AI_API_URL`                                                                                                                 | web (browser)                  | ➖            | Buzrr-AI origin, no `/api` suffix. **Unset ⇒ the AI Spaces section is hidden entirely.**                                                      |
| `AI_DATABASE_URL`                                                                                                                        | ai                             | ✅            | Same Postgres; owns the `ai` schema only. Prod should use a schema-scoped role.                                                               |
| `AI_WEB_ORIGIN`                                                                                                                          | ai                             | ✅            | CORS allow-list. **Unset fails closed** (deliberately unlike `WEB_ORIGIN`).                                                                   |
| `BETTER_AUTH_SECRET`, `REDIS_URL`                                                                                                        | ai                             | ✅            | Shared with the other apps.                                                                                                                   |
| `GEMINI_API_KEY` or `LLM_BASE_URL` (+`AI_GENERATION_MODEL`, `AI_EMBEDDING_MODEL`)                                                        | ai                             | ✅ one        | A model provider is **required** here, unlike on the server; settings validation fails boot otherwise. Embeddings must be 768-dim.            |
| `AI_PORT`, `AI_TMP_DIR`, `AI_MAX_UPLOAD_MB`, …                                                                                           | ai                             | ➖            | Full list with defaults: `apps/ai/.env.example`.                                                                                              |
| `AI_BUZRR_API_URL`                                                                                                                       | ai                             | ✅            | Nest origin (no `/api`); each generation reserves an AI plan token there. Unreachable ⇒ generation fails closed (503).                        |

### Adding an env var (checklist — five places, easy to miss)

1. The relevant `.env.example` template(s) — they're the documented contract.
2. `scripts/setup.mjs` — the `ENV_FILES` template, **plus**
   `REQUIRED_LOCAL_KEYS` if the app can't run without it (that's the
   self-healing list).
3. `turbo.json` `globalEnv` — if it affects builds/caching.
4. `.github/workflows/ci.yml` `env:` block — if the build/boot needs it in CI.
5. Reading it: server via `ConfigService` (or `process.env` at bootstrap);
   web via `process.env.NEXT_PUBLIC_*` only for browser-visible values
   (inlined at build time — changing them requires a rebuild, and they must
   be set in the hosting dashboard, not just `.env`).

## Deployment (from README + configs; hosting specifics are not in-repo)

- **Web → Vercel.** `.vercelignore` present; Vercel Analytics wired in the
  root layout; README describes gating production deploys on the CI workflow
  ("Deployment Checks"). `output: "standalone"` in `next.config.ts`.
- **Server → any long-lived container/VM host** (README names Render, Railway,
  Fly; commit d16616a references a Render deploy). It cannot be serverless:
  it holds Socket.IO connections, in-process timers, and lazy background
  workers. Prisma `binaryTargets` includes `rhel-openssl-3.0.x` for such
  hosts. Health probe: `GET /health` (200/503 with per-dependency status).
- **Buzrr-AI → the same kind of container host**, two processes from one image
  (`apps/ai/Dockerfile`, the repo's first): `uvicorn` and
  `arq buzrr_ai.worker.WorkerSettings`. Health probe `GET /health`, same shape as
  the Nest one. Migrations are a release step — `alembic upgrade head`, never at
  boot, mirroring `prisma migrate deploy`. **The managed Postgres must support
  the `pgvector` extension.**
- **Managed Redis (Upstash-compatible)**: `redis.module.ts` and matchmaking/
  sweeper laziness are explicitly tuned for Upstash's per-command pricing and
  idle-connection behavior.
- **Buzrr Pro billing (optional).** To turn it on:
  - Set `BILLING=ON` plus the Dodo vars on the server, and
    `DODO_PAYMENTS_WEBHOOK_KEY` on the web app.
  - Register `https://<web>/api/webhooks/dodo` in the Dodo dashboard,
    subscribed to the events listed in ADR-010.
  - Create the Pro product with an INR localized price of ₹399 (39900 paise;
    `by_country` + `IN`, or `by_currency`). Turn Adaptive Currency off if
    everyone outside India should be charged in USD.
  - Set `AI_BUZRR_API_URL` on `apps/ai`.
  - Apply migration `20260914000001` with `migrate:deploy`.
- **Production DB migrations**: `yarn workspace @buzrr/prisma migrate:deploy`
  (`prisma migrate deploy`); local dev uses `db push` instead. Never
  `db push` against prod. Fresh databases (self-hosting) use
  `yarn workspace @buzrr/prisma deploy`, which baselines first
  ([data.md](data.md#prisma-package-packagesprisma)).
- **Self-hosted → `docker compose up -d`** (user guide:
  [docs/self-hosting.md](../self-hosting.md); [ADR-014](../adr/014-self-hosting-without-saas.md)).
  Images: `apps/server/Dockerfile` (API; also runs migrations — keeps dev
  deps for the Prisma CLI) and `apps/web/Dockerfile` (Next standalone;
  `PUBLIC_API_URL`/`PUBLIC_WEB_URL`/`PUBLIC_AI_API_URL` are **build args**
  because `NEXT_PUBLIC_*` is compiled in), both built from the repo root
  (`.dockerignore` keeps `.env` files out). Services: `postgres`, `redis`,
  `auth-secret` (one-shot: generates `BETTER_AUTH_SECRET` into the
  `buzrr-secrets` volume unless `.env` sets one; every app container's
  entrypoint reads it), `migrate` (one-shot: `scripts/deploy.mjs` + the
  idempotent duel starter pack), `server`, `web`; profile `ai` adds
  `ai-migrate`/`ai`/`ai-worker`, profile `ollama` a local model server.
  Defaults: `BILLING=OFF`, `STORAGE_DRIVER=local` on the `buzrr-uploads`
  volume, local accounts on, `LANDING_VIDEO_URL` empty — nothing external.
  Upgrades: `git pull && docker compose up -d --build`. A Helm chart does not
  exist yet.
- Scale-out of the server is designed-for (Redis adapter + locks — see
  [realtime.md](realtime.md#timing--timer-ownership-multi-instance-model));
  actual instance count in production is not recorded in the repo.

<a id="vinext"></a>

## The parallel vinext toolchain (status: present, non-default)

Facts in the repo: commit `4c6fea6 feat: vinext migration (#10)` added
`vite.config.ts` (vinext + nitro + tailwind plugins, SSR externals for
prisma/better-auth/pg), package scripts `dev:vinext` / `build:vinext` /
`build:vercel` (`vite build`) / `start:vinext`, and a vendored skill
`.agents/skills/migrate-to-vinext/`. The **default** `dev`/`build`/`start`
scripts still use the Next CLI, and CI builds with `yarn build` (Next).
Which pipeline the live Vercel deployment uses is **not determinable from the
repo** — treat the Next CLI as canonical for local work and don't break
`vite.config.ts` without checking both builds.

## CI (`.github/workflows/ci.yml`)

One workflow, four jobs, on every push/PR to `main`:

1. **build** — real Postgres+Redis service containers; corepack + Yarn 4
   immutable install; `yarn workspace @buzrr/prisma build`; `prisma db push`;
   `yarn lint` (web only — root script filters `--filter=web`);
   `yarn check-types` (root tsc -b for contract+server+prisma, then web
   tsc); `yarn workspace server test` (vitest: billing specs against the
   Postgres service, plus the pure engine core, question-type, storage and
   LLM specs); `yarn build` (everything, via turbo).
2. **verify-docker-setup** — proves the contributor onboarding path:
   `docker compose up -d postgres redis`, wait for health, `db push`,
   teardown.
3. **self-host** — proves the self-hosting path with no configuration:
   `docker compose up -d --build --wait`, then `/health`, the login page, a
   local sign-up and an access token; logs on failure; `down -v`.

4. **python-ai** — pgvector + Redis service containers; setup-python 3.12;
   `ruff check`, `ruff format --check`, `mypy`, `alembic upgrade head` (proving
   migrations apply from scratch), then `pytest`.

Notes: read-only token, concurrency-cancel superseded runs. For `apps/web`,
"CI green" still means lint+types+build only. In `apps/server` the engine's
pure core is unit-tested, but its shell (`GameEngineService`, the Lua
scripts in `GameStoreService`, ELO persistence) has no automated tests. Husky pre-commit runs
lint-staged + lint + typecheck locally.

## External services (integration points)

| Service                                                             | Where integrated                                                                                                                  | Failure mode                                                                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Google OAuth (optional)                                             | web Better Auth (`lib/auth.ts`, `lib/auth-methods.ts`)                                                                            | off without creds; local accounts (`AUTH_EMAIL_PASSWORD=ON`) need no provider                                     |
| Gemini **or** an OpenAI-compatible server                           | `common/llm/` (`TextGenerator`) ← `quizzes.service.ts#createWithAi`                                                               | 400 if nothing configured; 502/503 mapped from provider errors                                                    |
| Gemini **or** an OpenAI-compatible server (generation + embeddings) | `apps/ai` (`providers/gemini.py`, `providers/openai_compat.py`)                                                                   | retried with backoff, then mapped to the same 502/503 envelope; wrong embedding width explained                   |
| Cloudinary **or** S3-compatible **or** local disk                   | `common/storage/` (`MediaStorage`) ← question upsert                                                                              | upload errors fail that request; bad config fails boot                                                            |
| Upstash REST (rate limit)                                           | `common/services/rate-limit.service.ts`                                                                                           | disabled unless `RATELIMIT=ON`; upstream errors → 503 on guarded routes                                           |
| GitHub REST                                                         | `apps/web/src/lib/github-stats.ts` (landing stats, 1h cache)                                                                      | nulls → UI hides numbers                                                                                          |
| Vercel Analytics                                                    | web root layout                                                                                                                   | no-op outside Vercel                                                                                              |
| Dodo Payments                                                       | `apps/server/src/modules/billing` (checkout, portal, `subscriptions.retrieve`); webhooks via `apps/web/src/app/api/webhooks/dodo` | only with `BILLING=ON`; outage ⇒ webhooks 503 and get redelivered, checkout/portal 502; existing plans unaffected |
