# ADR-005: Ephemeral guest Player identities with player-typed JWTs

**Status:** Accepted

## Context

Kahoot-style rooms only work if joining is frictionless — no account, just a
code and a name. But the server still needs to authenticate socket
connections and answer submissions, and hosts need kick/ban to stick.

## Decision

- `POST /api/players` (public, rate-limited) creates a bare `Player` row
  (name + avatar) and returns a 7-day JWT with `typ: "player"`, stored in the
  browser's `localStorage` (`playerToken`/`playerId`).
- Room membership is a nullable `Player.gameId` pointer set by the join
  endpoint (cap-checked, serializable) and cleared on leave/kick/game-end.
  Player rows are **never deleted** — identity survives across rooms; a
  kicked player can immediately join another room.
- Player sockets must present the player JWT _and_ match the Postgres
  membership (`validateConnection`); bans are Redis room-scoped, not
  identity-level.
- The `typ` claim keeps player tokens out of every account-only surface
  (`CurrentAccountUser`, socket admin/duel paths).

## Consequences

- Zero-friction join, while all gameplay writes are still authenticated.
- `Player` rows accumulate unboundedly (no cleanup job exists) — accepted;
  final results snapshot names so old rows aren't load-bearing.
- Identity is per-browser; clearing storage or switching devices makes a new
  player.

## Alternatives

Not recorded.

## Evidence

`players.service.ts` / `players.controller.ts`;
`game-sessions.service.ts#join/detachPlayer` ("The player row itself is never
deleted"); `realtime.service.ts` player branch; `usePlayerSocket.ts` comments
(kick keeps identity); schema `Player` model.
