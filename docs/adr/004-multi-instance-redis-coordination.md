# ADR-004: Multi-instance coordination via Redis only

**Status:** Accepted

## Context

The game server holds sockets and in-process timers, but must be able to run
as more than one instance (deploys, restarts, scale-out) without a game
double-advancing or a broadcast missing sockets parked on another instance.
No message broker exists in the stack.

## Decision

All cross-instance coordination uses Redis primitives:

- **Broadcasts:** `@socket.io/redis-adapter` (`redis-io.adapter.ts`) with
  dedicated pub/sub ioredis clients; per-player rooms (`player:{id}`) make
  targeted emits and `disconnectSockets` work across instances.
- **Timer ownership:** `game:{code}:owner` — `SET NX PX 20000` + renew-if-held
  Lua (`ensureOwner`); every deadline handler acquires it before acting.
- **Schedule:** `games:deadlines` zset is the durable timer source; local
  `setTimeout`s are just an optimization over the sweeper.
- **Matchmaking:** pairing under `mm:duel:lock` with zrem-count verification
  and rollback.
- **Atomic state transitions:** Lua scripts for meta init, roster-vs-ban,
  end-claim, invite create/claim/release/cancel.
- **Cost discipline:** background loops (sweeper, matchmaking tick) start
  lazily and stop when idle — explicitly to spare the Upstash per-command
  budget (~350K commands/month for one idle 15s poll, per the code comment).

## Consequences

- Any new time- or event-driven behavior must use these patterns; naive
  `setInterval` polling or instance-local state breaks either correctness or
  the Upstash budget.
- Some timers are knowingly instance-local and lost on crash (lobby
  disconnect grace, duel forfeit grace, bot answer timer) — with recovery
  paths for the ones that matter (`recoverBotAnswer`, sweeper abandon check).
- No broker to operate; Redis is a single point of failure for realtime.

## Alternatives

Not recorded.

## Evidence

`redis/redis-io.adapter.ts`, `redis/redis.module.ts`;
`game-store.service.ts` (owner lock, deadline set, Lua scripts);
`game-engine.service.ts` (`ensureSweeper` cost comment, `handleDeadline`);
`matchmaking.service.ts` (`pair`, lazy worker); `duel-invite.service.ts`
(scripts, adapter-derived presence).
