# Infrastructure: local dev, environments, deployment, CI, external services

## Local development

- `yarn setup` (`scripts/setup.mjs`) — idempotent bootstrap: checks Docker,
  writes `.env` files (never overwrites; re-adds missing required keys with
  local defaults; mints a shared `BETTER_AUTH_SECRET`), starts
  `docker-compose.yml` (Postgres 16 + Redis 7, named volumes, healthchecks),
  waits for Postgres, `prisma db push`, `prisma generate`.
- `yarn dev` — turborepo runs `next dev` (:3000) + `nest start --watch`
  (:3001). Only manual step: Google OAuth creds in `apps/web/.env`.
- Resets: `yarn docker:reset` (wipe volumes + re-setup). DB browsing:
  `yarn db:studio`.

### Exercising each mode locally (non-obvious recipes)

- **Classic room**: sign in as host in one browser, open `/player` (or the
  join link the lobby shows) in an incognito window — guests need no account.
- **Rated duel**: one signed-in account is enough — queue on `/duel` and a
  bot matches you after ~12s (`DUEL_BOTS` defaults on). Human-vs-human or
  friend invites need **two Google accounts in two browser profiles**.
- **Empty duel pool** ("No duel questions are available"): build then seed —
  `yarn workspace @buzrr/prisma build && yarn workspace @buzrr/prisma seed:duel`.
- **Inspect live game state**: `docker exec -it buzrr-redis redis-cli`, then
  `KEYS game:*`, `HGETALL game:<CODE>:meta`,
  `ZRANGE games:deadlines 0 -1 WITHSCORES`, `ZRANGE mm:duel:queue 0 -1 WITHSCORES`.
- **Single app**: `yarn dev:server` / `yarn dev:web`. Server logs are Nest
  `Logger` lines on stdout (game/duel events log by gameCode).

## Environment variables (authoritative list per app)

Templates are the truth: root `.env.example`, `apps/web/.env.example`,
`apps/server/.env.example`. Summary:

| Var                                              | Used by           | Required     | Notes                                                                                                                    |
| ------------------------------------------------ | ----------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL` / `DIRECT_URL`                    | both + prisma CLI | ✅           | pg driver adapter; root `.env` feeds the Prisma CLI (`prisma.config.ts` reads `DIRECT_URL`).                             |
| `BETTER_AUTH_SECRET`                             | both              | ✅           | **Must match across web and server** — the whole trust chain ([auth.md](auth.md)).                                       |
| `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`             | web               | ✅           | Better Auth base + allowed origins.                                                                                      |
| `GOOGLE_CLIENT_ID/SECRET`                        | web               | ✅           | Only login method; auth throws without them at first use.                                                                |
| `REDIS_URL`                                      | server            | ✅           | Server **refuses to boot** without it (`redis.module.ts`). Upstash `rediss://` supported (keepAlive tuned for it).       |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL` | web (browser)     | ✅           | Nest origin, no `/api` suffix (`lib/api/client.ts` appends it).                                                          |
| `NEXT_PUBLIC_APP_URL`                            | web               | ➖           | Public origin for join/invite links & QR (`lib/join-link.ts`); falls back to `window.location.origin`.                   |
| `WEB_ORIGIN`                                     | server            | prod ✅      | CORS allow-list (comma-separated). **Unset ⇒ reflect all origins** (`parse-cors-origin.ts`) — fine locally, not in prod. |
| `PORT` / `API_PORT`                              | server            | ➖           | `API_PORT` wins; default 3001.                                                                                           |
| `TRUST_PROXY`                                    | server            | behind proxy | Express `trust proxy` for honest `request.ip` (rate limiting).                                                           |
| `GEMINI_API_KEY`                                 | server            | ➖           | Enables `POST /api/quizzes/ai`.                                                                                          |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`       | server            | ➖           | Enables media on questions.                                                                                              |
| `RATELIMIT` (+`UPSTASH_REDIS_REST_URL/TOKEN`)    | server            | ➖           | `ON` activates per-IP limits via Upstash REST. `ON` without creds ⇒ guarded routes 503.                                  |
| `DUEL_BOTS`                                      | server            | ➖           | `OFF` disables the 15s bot fallback in matchmaking.                                                                      |
| `GITHUB_TOKEN`                                   | web (SSR)         | ➖           | Higher rate limits for landing-page repo stats.                                                                          |

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
- **Managed Redis (Upstash-compatible)**: `redis.module.ts` and matchmaking/
  sweeper laziness are explicitly tuned for Upstash's per-command pricing and
  idle-connection behavior.
- **Production DB migrations**: `yarn workspace @buzrr/prisma migrate:deploy`
  (`prisma migrate deploy`); local dev uses `db push` instead. Never
  `db push` against prod.
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

One workflow, two jobs, on every push/PR to `main`:

1. **build** — real Postgres+Redis service containers; corepack + Yarn 4
   immutable install; `yarn workspace @buzrr/prisma build`; `prisma db push`;
   `yarn lint` (web only — root script filters `--filter=web`);
   `yarn check-types` (root tsc -b for server+prisma, then web tsc);
   `yarn build` (everything, via turbo).
2. **verify-docker-setup** — proves the contributor onboarding path:
   `docker compose up`, wait for health, `db push`, teardown.

Notes: read-only token, concurrency-cancel superseded runs, **no tests exist
anywhere** — "CI green" means lint+types+build only. Husky pre-commit runs
lint-staged + lint + typecheck locally.

## External services (integration points)

| Service                     | Where integrated                                             | Failure mode                                                            |
| --------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Google OAuth                | web Better Auth (`lib/auth.ts`)                              | login unusable without creds (throws at first auth call)                |
| Gemini (`gemini-2.5-flash`) | `quizzes.service.ts#createWithAi`                            | 400 if key missing; 502/503 mapped from API errors                      |
| Cloudinary                  | `common/services/cloudinary.service.ts` ← question upsert    | uploads fail; rest of app unaffected                                    |
| Upstash REST (rate limit)   | `common/services/rate-limit.service.ts`                      | disabled unless `RATELIMIT=ON`; upstream errors → 503 on guarded routes |
| GitHub REST                 | `apps/web/src/lib/github-stats.ts` (landing stats, 1h cache) | nulls → UI hides numbers                                                |
| Vercel Analytics            | web root layout                                              | no-op outside Vercel                                                    |
