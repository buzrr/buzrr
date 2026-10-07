# ADR-012: A pure engine core, and pacing as a strategy

**Status:** Accepted

## Context

`GameEngineService` (~1,400 lines) interleaved the rules of the game with
Redis reads, timers and socket emits, which is why it had no tests:
`docs/CONTEXT.md` ranked "no engine tests" as the #1 debt. The two pacing
modes (host-paced classic, auto-advancing duels) were `mode === "duel"`
branches scattered through it, so a third mode (self-paced, on the roadmap)
had no clean place to go.

## Decision

1. **The phase machine is a pure function**:
   `step(state, event, now) → { state, effects }`
   (`apps/server/src/modules/game-engine/core/machine.ts`). Events are
   `start`, `host-next`, `deadline`, `answer-recorded`, `close-question`,
   `roster-changed`. Effects are data (`patch-meta`, `set-deadline`,
   `arm-timer`, `emit`, `arm-bot`, `end-game`, …) executed **in order** by the
   shell, which preserves the orderings the realtime invariants depend on.
   Answer judging (`judgeAnswer`), snapshot/leaderboard projection
   (`views.ts`) and the presence decisions (`lifecycle.ts`) are pure too.
2. **`GameEngineService` is the shell.** It loads the state each event needs
   (`PARTS_FOR`, one pipelined Redis round trip after the meta), runs the
   effects, and keeps everything that needs I/O or atomicity: first-write
   answers (`HSETNX`), the end-of-game claim, pause/resume claims, owner
   lock, timers, recovery and result persistence.
3. **Pacing is a strategy** (`core/pacing.ts`): `hostControlled`,
   `revealEndsAt(now)`, `endsOnFinal`. `hostPaced` (classic) and
   `autoAdvance` (duel) are the two today; a game's pacing is stored in
   meta (`pacing`), with games that predate the field falling back to what
   their mode implied.

## Consequences

- The rules are covered by plain unit tests (`core/__tests__`, no Redis), run
  in CI with the existing vitest job.
- One deliberate behaviour change fell out: a host-paced reveal whose parked
  deadline comes due is re-parked instead of auto-advancing.
- Writing the snapshot tests exposed that a player's mid-question
  `state-sync` revealed whether their stored answer was correct (and the
  points it moved). `you` is now masked until the reveal (invariant #18).
- Self-paced play needs per-player question state the shared machine doesn't
  model; the strategy is where its "who advances" rules will live, but the
  state model will need extending. Not built.
- The shell itself (Lua races, recovery, ELO persistence) is still only
  exercised end to end, not by unit tests.

## Evidence

`apps/server/src/modules/game-engine/core/`, `game-engine.service.ts`
(`dispatch`, `run`), `game-store.service.ts` (`loadState`).
