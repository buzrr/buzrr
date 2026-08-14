# Agent change log — meaningful architectural changes only

One line per **architecturally meaningful** change made by a coding agent (or
human, if they like): date · PR/commit if known · what changed at the
architecture level. Newest first.

**Log it only if** it changed architecture, data flow, service boundaries,
schema (Postgres or Redis keys), the socket contract, auth, infrastructure,
or an invariant — i.e. the same test that requires a docs update in
[AGENTS.md](../AGENTS.md#how-agents-must-maintain-these-docs). Bug fixes,
styling, copy, and mechanical refactors do **not** belong here. Keep entries
to one or two lines; details go in the architecture docs/ADRs the entry
points to.

Format:

```
- YYYY-MM-DD (PR#/commit) — summary. Docs touched: file, file / ADR-NNN.
```

## Entries

- 2026-08-14 — Retired the legacy v1 compatibility layer: engine dual-emits,
  gateway v1 host-intent aliases, `POST /game-sessions/:id/answers` (+ DTO,
  `submitAnswerCurrent`), and the vestigial `GameSession.gameState` /
  `currentQuestion` columns and `GameStates` enum (migration
  `20260814000001`). Socket contract is now single-version. Docs touched:
  realtime.md, backend.md, data.md, auth.md, frontend.md, invariants.md
  (#26 inverted), CONTEXT.md, ADR-002 (amended). Also extracted the
  architecture write-up out of README into a root
  [ARCHITECTURE.md](../ARCHITECTURE.md) (linked from README/AGENTS/CLAUDE).
- 2026-08-14 — Documentation system created from a full codebase audit
  (AGENTS.md, docs/architecture/\*, docs/adr/001–008, CONTEXT.md, this log).
  No application code changed.
