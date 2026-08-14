# ADR-006: ELO matchmaking with widening bands, bot fallback, unrated friend invites

**Status:** Accepted (duels+ELO in PR #17 `ce3a081`; invites in PR #34
`ff7ab59`; bots in PR #39 `fa002bc`)

## Context

Ranked 1v1 needs fair pairing, but a small early player base means the queue
is often empty — and a friend-challenge mode must not become an ELO-farming
vector.

## Decision

- **Rating:** classic ELO (`common/utils/elo.ts`) — start 1200, floor 100,
  K=40 for the first 10 duels then 24; forfeit = loss; equal score = draw.
  Applied atomically with the `GameResult` write.
- **Queue:** Redis zset keyed by ELO; longest-waiting seeker first; the
  acceptable gap widens 100→500 with wait time (`eloBand`); 60s timeout; one
  match per 2s tick; lazy worker.
- **Bots:** a queuer alone ≥15s gets a difficulty-tiered bot (tier by their
  ELO; bot ELO mirrors theirs ±75) unless `DUEL_BOTS=OFF`. Bot duels are
  **rated** (only the human's rating updates; the bot's comes from meta) and
  deliberately indistinguishable from human matches in every payload; bot
  answers run through the normal validated path with human-plausible delays.
- **Friend invites are unrated** (`rated: false`) — same gameplay, ratings
  untouched, "so two accounts can't farm rating off each other"
  (`startDuel` doc comment).

## Consequences

- Nobody waits more than ~15s for _a_ game; ladder integrity is preserved by
  the rated/unrated split.
- The `rated` check is `!== false` on purpose (pre-field Redis games stay
  rated across the deploy that introduced it) — keep that semantics.
- Bot behavior parameters (`BOT_PROFILES`, delay bounds) directly shape
  perceived fairness and expected ELO drift; tune deliberately.

## Alternatives

Not recorded.

## Evidence

`matchmaking.service.ts` (band/eligibility comments, `tryBotMatch` re-check
logic); `common/utils/duel-bot.ts` (all comments); `elo.ts`;
`persistResult` in `game-engine.service.ts`; `duel-invite.service.ts`
(`rated: false`).
