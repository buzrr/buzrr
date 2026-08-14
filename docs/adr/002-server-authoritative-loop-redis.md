# ADR-002: Server-authoritative game loop with live state in Redis

**Status:** Accepted (landed as PR #17, commit `ce3a081 "refactor: server owns
game loop; add Redis live state and 1v1 duels with ELO"`)

## Context

Earlier iterations let clients drive question advancement and report their own
answer timing (that design's socket events `set-question-index` /
`change-question`, a client-reported `timeTaken` field, and the tables
`PlayerAnswer`/`GameLeaderboard` are all gone now). Client-driven timing is
cheatable and per-answer Postgres writes couple gameplay latency to the
database.

## Decision

- A single engine (`game-engine.service.ts`) owns phases, timers and scoring;
  clients send intent only. Time taken is measured server-side.
- All mutable game state lives in Redis (`GameStoreService`, `game:{code}:*`,
  6h TTL) — Postgres keeps only the classic lobby record (`GameSession`) and
  the immutable outcome (`GameResult` + entries), written once at game end.
- Recovery is built in: deadlines in a Redis sorted set, boot-time
  `recoverTimers()`, a lazy 15s sweeper for lost timers and host-abandoned
  games.
- Clients resync via a full `state-sync` snapshot on every (re)connect.

## Consequences

- Anti-cheat by construction (server clocks, first-answer-wins, correctness
  stripped from payloads).
- Process restarts and multi-instance operation resume live games (ADR-004).
- Redis became a hard boot dependency (`REDIS_URL` required).
- 6h TTL bounds game length and garbage-collects abandoned rooms.
- A dual (v2 + legacy v1) socket contract had to be maintained during the
  client migration. **Retired 2026-08-14** — see the amendment below.

## Amendment (2026-08-14): the compatibility layer is gone

The migration finished, so the transitional surface was removed rather than
left to rot: the engine's v1 dual-emits, the gateway's v1 host-intent aliases,
the `POST /game-sessions/:id/answers` fallback route with its DTO and
`submitAnswerCurrent`, and the vestigial `GameSession.gameState` /
`currentQuestion` columns (migration
`20260814000001_drop_vestigial_game_session_columns`, which also drops the
`GameStates` enum).

Rationale: nothing consumed any of it — the web app is the only client, and
both apps deploy from this repo, so a "not-yet-migrated client" was a
hypothetical rather than a supported case. Keeping it cost more than it
bought: the dead columns invited resume logic to be "fixed" against Postgres
values the engine never advances, and the aliases implied a client-supplied
question index still mattered.

Accepted risk: a browser holding a stale JS bundle across the deploy loses its
v1 fallbacks. Impact is a reload, and only for a session that is mid-game
during a deploy.

## Alternatives

Keeping authoritative state in Postgres (the prior design) — explicitly moved
away from; migration `20260712000003_drop_unused_tables` deletes its tables.

## Evidence

`game-engine.service.ts` header comment; `game-store.service.ts` header
comment; `realtime.types.ts` "The server owns all timing"; migrations
`20260712000001..3`, `20260814000001`; commit `ce3a081`; sweeper-cost comment
in `ensureSweeper()`.
