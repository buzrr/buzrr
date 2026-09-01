# AGENTS.md — Buzrr guide for coding agents

This file is the entry point for AI coding agents (and new humans) working on
Buzrr. It tells you what the system is, what to read for a given task, the
rules you must not break, and how to keep this documentation alive.

> **Code is the source of truth. Documentation must never override the
> implementation.** If a doc contradicts the code, trust the code, fix the
> doc, and note the discrepancy in your change summary.

## What Buzrr is

Open-source "QuizUp + Kahoot in one app":

- **Classic mode (Kahoot-style)** — a signed-in host creates a quiz and opens a
  room; anonymous players join with a 6-char code and answer live over
  WebSockets.
- **Duel mode (QuizUp-style)** — signed-in users fight ranked 1v1 battles via
  ELO matchmaking (with bot fallback) or unrated friend-invite links.
- Extras: AI quiz generation (Gemini), image questions (Cloudinary), community
  question moderation, roles (user/admin/superadmin).

## Repository shape

Turborepo + Yarn 4 workspaces:

| Path                                                   | What it is                                                                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                                             | Next.js 15 frontend (React 19, App Router). Also hosts **Better Auth** (`/api/auth/*`) — the only web-owned API routes. |
| `apps/server`                                          | NestJS 11 — REST API (`/api/*`) + Socket.IO gateway + the server-authoritative game engine.                             |
| `apps/ai`                                              | **Buzrr-AI** — Python 3.12 + FastAPI + arq worker. Knowledge Spaces, document ingestion, RAG quiz generation. Optional. |
| `packages/prisma`                                      | `@buzrr/prisma`: Prisma schema, migrations, generated client, shared by both apps.                                      |
| `packages/eslint-config`, `packages/typescript-config` | Shared lint/tsconfig presets.                                                                                           |
| `scripts/setup.mjs`                                    | One-command local bootstrap (Docker Postgres+Redis, .env files, schema push).                                           |
| `docs/`                                                | Architecture docs, ADRs, current-state context (see below).                                                             |

Local dev: `yarn setup` then `yarn dev` (web :3000, api :3001). The AI service
is opt-in — `yarn workspace ai setup` then `yarn workspace ai dev` (:3002); with
`NEXT_PUBLIC_AI_API_URL` unset it is invisible to the rest of the app. Details:
[docs/architecture/infrastructure.md](docs/architecture/infrastructure.md).

## Read this before touching anything

1. This file (you're here).
2. [docs/CONTEXT.md](docs/CONTEXT.md) — current state, active work, known debt.
3. [docs/architecture/invariants.md](docs/architecture/invariants.md) — rules
   you must not break.
4. Then the area doc(s) for your task, from the map below.

## Task → reading map

| If your task touches…                                                           | Read                                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Anything (orientation)                                                          | [ARCHITECTURE.md](ARCHITECTURE.md) then [docs/architecture/overview.md](docs/architecture/overview.md) |
| Live gameplay, phases, timers, scoring, reconnect, kick/ban                     | [docs/architecture/realtime.md](docs/architecture/realtime.md)                                         |
| Matchmaking, duel invites, bots, ELO                                            | [docs/architecture/duels.md](docs/architecture/duels.md) + realtime.md                                 |
| Database schema, Redis keys, what's stored where                                | [docs/architecture/data.md](docs/architecture/data.md)                                                 |
| Login, JWTs, socket auth, roles, guards                                         | [docs/architecture/auth.md](docs/architecture/auth.md)                                                 |
| REST endpoints, Nest modules, validation, rate limiting, moderation             | [docs/architecture/backend.md](docs/architecture/backend.md)                                           |
| React pages, components, Redux/React-Query state, socket hooks                  | [docs/architecture/frontend.md](docs/architecture/frontend.md)                                         |
| Knowledge Spaces, document ingestion, embeddings, RAG, the Python service       | [docs/architecture/ai.md](docs/architecture/ai.md)                                                     |
| Env vars, deployment, CI, Docker, external services (Gemini/Cloudinary/Upstash) | [docs/architecture/infrastructure.md](docs/architecture/infrastructure.md)                             |
| "Why is it built this way?"                                                     | [docs/adr/](docs/adr/)                                                                                 |

**Step-by-step playbooks for the four most common multi-file changes** —
schema/migration: [data.md § Changing the schema](docs/architecture/data.md#changing-the-schema-the-workflow-this-repo-actually-uses) ·
socket event: [realtime.md § Changing the socket contract](docs/architecture/realtime.md#changing-the-socket-contract--touch-list) ·
REST endpoint: [backend.md § Adding an endpoint](docs/architecture/backend.md#adding-an-endpoint-the-house-pattern) ·
env var: [infrastructure.md § Adding an env var](docs/architecture/infrastructure.md#adding-an-env-var-checklist--five-places-easy-to-miss).
Local run/test/debug recipes: [infrastructure.md § Exercising each mode](docs/architecture/infrastructure.md#exercising-each-mode-locally-non-obvious-recipes).

## The five rules that matter most

(Full list with evidence: [docs/architecture/invariants.md](docs/architecture/invariants.md))

1. **The server owns the game loop.** All timing, phase transitions and
   scoring happen in `apps/server/src/modules/game-engine/`. Clients only send
   intent (`start-game`, `host-next`, `submit-answer`) and render pushed state.
   Never add client-side authority.
2. **Live game state lives in Redis; Postgres only sees the lobby record and
   the final `GameResult`.** Do not write per-answer or mid-game state to
   Postgres.
3. **`BETTER_AUTH_SECRET` is the trust boundary.** The web app signs HS256
   JWTs with it; the Nest server verifies them. Web and server must always
   share it, and player tokens carry `typ: "player"` — never blur account vs
   player identity.
4. **Multi-instance safety is deliberate.** Socket.IO uses the Redis adapter;
   per-game timer ownership uses a Redis owner lock; matchmaking uses a Redis
   lock. Any new timer/broadcast must work when N server instances run.
5. **Role checks hit the DB, not the JWT.** Tokens live 7 days; a demotion
   must apply immediately (`RolesGuard`).

## How agents must maintain these docs

After completing any task, run this checklist:

1. Did the change alter architecture, data flow, service boundaries, Redis/DB
   schema, the socket contract, auth, infrastructure, or an invariant?
   - **No** (bug fix, styling, copy, non-structural refactor) → change no docs.
   - **Yes** → update the relevant `docs/architecture/*.md` file(s). Keep the
     edit surgical; don't rewrite whole files. If the change would make the
     root [ARCHITECTURE.md](ARCHITECTURE.md) wrong — the game loop, the timer
     model, the Redis/Postgres split, the repo's shape — fix that too; it is
     the public front door and the first thing newcomers read.
2. Introduced or reversed a significant architectural decision? → add or amend
   an ADR in `docs/adr/` (copy the format of an existing one; never invent
   rationale you don't have).
3. Did the "current state" shift (feature shipped, migration finished, new
   debt)? → update [docs/CONTEXT.md](docs/CONTEXT.md).
4. If you did 1–3, append one line to [docs/agent-log.md](docs/agent-log.md)
   (date, PR/commit if known, one sentence). Do **not** log routine changes.
5. Found docs contradicting code while working? Fix the doc if it's quick, or
   flag it in your summary — never silently trust the doc.

Anti-churn rules: prefer editing over adding files; don't duplicate content
across docs (link instead); don't document what a `grep` trivially reveals;
keep `docs/CONTEXT.md` about the present, not history.

## Conventions the repo enforces

- Conventional Commits (`feat:`, `fix:`, `refactor:`…) — see CONTRIBUTING.md.
- Husky pre-commit runs `lint-staged` + `yarn lint` + `yarn check-types`.
- CI = lint, typecheck, build (no test suite exists — don't claim tests pass).
- DB changes go through `packages/prisma/schema.prisma` **plus** a migration in
  `packages/prisma/migrations/` for anything headed to production (local dev
  uses `db push`).
- TypeScript strict; no new `any`. Match surrounding code style.
