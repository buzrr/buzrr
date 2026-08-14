# Authentication & authorization

Three identity kinds, one shared secret. Auth spans both apps, so changes here
need cross-app thinking.

## Identity kinds

| Identity           | Who                           | Issued by                                       | Carried as                                                                           |
| ------------------ | ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Account (User)** | Hosts, duelists, admins       | Better Auth (Google OAuth) in the **web** app   | Better Auth session cookie (web) → exchanged for a 7d HS256 JWT to call the API      |
| **Player**         | Anonymous classic-mode guests | Nest `POST /api/players` (`players.service.ts`) | 7d HS256 JWT with `typ: "player"`, kept in `localStorage` (`playerToken`/`playerId`) |
| **Bot**            | Duel bot opponents            | Server-internal                                 | No credentials — just a `bot_`-prefixed roster id; never authenticates               |

## The trust chain (web ⇄ server)

1. **Better Auth lives in the web app only.** Config:
   `apps/web/src/lib/auth.ts` (lazy proxy so builds don't need creds); routes:
   `src/app/api/auth/[...all]/route.ts`. Google is the only provider; session
   cookie has a 5-min cookie cache; `deleteUser` enabled (settings
   danger-zone). Better Auth writes `users/accounts/sessions/verification`
   tables via the Prisma adapter.
2. **JWT bridge:** `GET /api/auth/access-token`
   (`src/app/api/auth/access-token/route.ts`) reads the session cookie and
   signs `{ sub: userId, email }` HS256 with **`BETTER_AUTH_SECRET`**, 7d
   expiry (jose). The browser caches it in memory
   (`lib/api/get-access-token.ts`) and axios attaches it
   (`lib/api/client.ts`).
3. **The Nest server verifies that JWT** with the same secret — passport-jwt
   strategy `apps/server/src/modules/auth/jwt.strategy.ts`. It never talks to
   Google and has no login of its own. **Web and server `BETTER_AUTH_SECRET`
   must be identical or every API call 401s.**

`JwtStrategy.validate` splits on the `typ` claim: `typ === "player"` →
`{ playerId }`, else `{ userId, email }`. Player JWTs are minted by the server
itself (`PlayersService.create`).

## HTTP authorization (server)

- `JwtAuthGuard` is a **global APP_GUARD** (`app.module.ts`) — every HTTP
  route requires a valid JWT unless decorated `@Public()`
  (`common/decorators/public.decorator.ts`). It skips non-HTTP contexts, so
  sockets are _not_ guarded by it (they have their own validation, below).
- Handler-level identity typing via decorators
  (`common/decorators/current-user.decorator.ts`):
  `@CurrentAccountUser()` rejects player tokens, `@CurrentPlayerUser()`
  rejects account tokens. Use them — don't read `request.user` raw.
- **Roles**: `@Roles("admin", "superadmin")` + `RolesGuard`
  (`common/guards/roles.guard.ts`). Deliberately does a **fresh DB read of
  `User.role` per request** — JWTs live 7 days and a demotion must bite
  immediately. Never derive role from the token.
- Public routes (verified): `POST/PATCH/GET /api/players*`, `GET
/api/game-sessions/player-play/:playerId`, `GET /health`.
- Ownership checks are per-service (`where: { id, userId }` patterns in
  quizzes/questions/game-sessions services) — resource-level, not just
  authentication.

## Socket authentication (`realtime.service.ts` → `validateConnection`)

Handshake carries `userType` (`player|admin|duel`) + `gameCode` (+
`intent=invite` for invite waiting rooms). Token comes from `auth.token` or an
`Authorization: Bearer` header; **admin and duel sockets may instead present
the Better Auth session cookie** (`better-auth.session_token` /
`__Secure-…`), which the server resolves by looking the token up in the
`Session` table (`resolveAccountUserId`). Rationale (comment in
`useAdminSocket.ts`): the cookie is host-scoped to the web origin and doesn't
reach a cross-origin socket server — so JWT is primary, cookie is fallback.

Per-type checks:

- **player** — JWT must have `typ: "player"`; the Player row must exist and
  its `gameId` must equal the room being joined (set by the HTTP join).
- **admin** — resolved account must be the `GameSession.creatorId`.
- **duel** — any signed-in account; roster membership is enforced later
  against Redis for game connections; queue connections need no code.

Failures disconnect the socket; the client renders a hard "disconnected"
state on `io server disconnect` (`useGameSocket.ts`).

## Web-side gating (server components)

- `/admin/*`: session required (`app/admin/layout.tsx`), role fetched
  per-request and provided via `SessionProvider` context.
- `/admin/(privileged)/*`: role must be admin/superadmin;
  `(privileged)/superadmin/*`: superadmin only. Both re-check on the server —
  client context is for UI only.
- `/duel/*`: per-page `requireDuelSession(callbackURL)` (`lib/duel-session.ts`)
  so login redirects preserve deep links (layouts can't see the pathname).
- These are **UX gates**; the real enforcement is always the API's guards.

## Superadmin & role management

- `PATCH /api/superadmin/users/:id/role` (`admin-users.controller.ts`,
  superadmin-only): promote user→admin / demote admin→user. Cannot change
  yourself; cannot touch superadmins; superadmin is **not grantable** via the
  API (`UpdateUserRoleDto` allows only `admin|user`). The first superadmin was
  bootstrapped in migration `20260714000001` by email.

## Rate limiting (adjacent concern)

`RateLimitGuard` + `RateLimitService` (`common/`): Upstash **REST** client
(separate from the game's ioredis; may point at a different instance), only
active when `RATELIMIT=ON` and Upstash env vars exist. Per-IP sliding windows
by profile: `default` 50/120s, `ai` 3/300s, `report` 10/600s (set via
`@RateLimitProfile()`). Applied selectively (join/create-player, AI generation,
reports, invites…), not globally. `TRUST_PROXY` in `main.ts` makes
`request.ip` honest behind Render/Fly-style proxies.

## Sharp edges

- The access-token route and the player-token flow both sign with the same
  secret — only `typ` separates them. Anything that verifies a JWT must
  respect `typ` (see `RealtimeService` and both decorators).
- The client-side token cache (`get-access-token.ts`) assumes 7d validity and
  refreshes 60s early; sign-out does not proactively clear the server's
  ability to accept a previously minted JWT (tokens are stateless).
- `parse-cors-origin.ts`: unset/empty `WEB_ORIGIN` reflects **all** origins
  (dev convenience). Production must set `WEB_ORIGIN`.
