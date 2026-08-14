# ADR-001: Turborepo monorepo — Next.js web + NestJS realtime API + shared Prisma package

**Status:** Accepted

## Context

Buzrr needs both a content-heavy, SEO-relevant web frontend and a stateful
realtime backend (persistent WebSockets, in-process timers, background
workers). Those have incompatible hosting models: the frontend fits
serverless/edge (Vercel), the game server needs a long-lived process.

## Decision

One Turborepo (Yarn 4 workspaces) with two independently deployable apps —
`apps/web` (Next.js 15; also hosts Better Auth) and `apps/server` (NestJS 11;
REST + Socket.IO on one port) — plus `packages/prisma` so both apps share a
single schema and generated client, and shared lint/tsconfig presets.

The server was migrated _to_ NestJS (commit `e572d7e "Feat/migrate server
nest"`); the pre-Nest server's shape isn't preserved in the tree.

## Consequences

- Web deploys to Vercel; server must run on a container/VM host (README:
  Render/Railway/Fly; a Render deploy fix exists in history: `d16616a`).
- Browser talks to two origins → CORS (`WEB_ORIGIN`), `NEXT_PUBLIC_API_URL`/
  `NEXT_PUBLIC_SOCKET_URL`, and the JWT bridge (ADR-003) all exist because of
  this split.
- Schema changes ripple through `@buzrr/prisma` to both apps atomically; CI
  builds the package first.

## Alternatives

Not recorded. (A single Next.js app with API routes cannot host Socket.IO +
timers on Vercel, which the README's deployment section implies was the
constraint — inference.)

## Evidence

Repo layout; root `package.json`/`turbo.json`; [ARCHITECTURE.md](../../ARCHITECTURE.md)
and README "Deployment & CI"; `apps/server/src/main.ts`; commits `e572d7e`,
`a254f1d`.
