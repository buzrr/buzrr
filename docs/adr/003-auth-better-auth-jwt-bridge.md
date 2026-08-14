# ADR-003: Better Auth on the web app + shared-secret JWT bridge to the API

**Status:** Accepted (Better Auth adopted/stabilized across commits `9a5f73a`,
`79766b0`, `49b94f6`)

## Context

Sessions (Google OAuth) live in the Next.js app, but the domain API is a
separate NestJS origin (ADR-001). Cookies are host-scoped: the Better Auth
session cookie doesn't reach a cross-origin API/socket server (stated in
`useAdminSocket.ts`). The API needs a way to trust web-authenticated users,
and anonymous quiz players need credentials without accounts.

## Decision

- Better Auth (Google provider, Prisma adapter) runs **only** in `apps/web`
  (`lib/auth.ts`, `/api/auth/[...all]`).
- The web app exposes `GET /api/auth/access-token`: session cookie in → 7-day
  HS256 JWT out, signed with `BETTER_AUTH_SECRET` (jose).
- The Nest server verifies those JWTs via passport-jwt with the **same
  secret** (global `JwtAuthGuard`), and itself mints player JWTs with
  `typ: "player"` for anonymous guests (ADR-005). The `typ` claim is the only
  discriminator.
- Sockets: JWT primary; admin/duel sockets fall back to the session cookie,
  resolved against the `Session` table (`realtime.service.ts`).
- Privileged routes never trust the token for roles — fresh DB role lookup
  per request (`roles.guard.ts`).

## Consequences

- `BETTER_AUTH_SECRET` must match across apps or all API auth fails
  (README/setup script enforce this locally).
- Tokens are stateless for 7 days: sign-out doesn't revoke them — mitigated
  for authorization by the DB role lookups.
- The server stays provider-agnostic (no Google config server-side).

## Alternatives

Not recorded. (Options like a shared session store or an auth microservice
are not discussed anywhere in the repo.)

## Evidence

`apps/web/src/lib/auth.ts`, `src/app/api/auth/access-token/route.ts`,
`apps/web/src/lib/api/get-access-token.ts`;
`apps/server/src/modules/auth/*`, `common/guards/jwt-auth.guard.ts`,
`common/guards/roles.guard.ts` comment, `realtime.service.ts`
`resolveAccountUserId`; `useAdminSocket.ts` comment.
