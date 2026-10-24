# ADR-016: "Play alone" — tests over REST, outside the room engine

**Status:** Accepted (migration `20261020000002_solo_tests`)

## Context

Hosts want a quiz played without a live room: a link a class opens as
homework or a test, each player at their own pace, with the results
collected for the host — and a way to try a quiz alone. ADR-012 planned this
as a third pacing strategy, but the room engine has one phase and one
question pointer per room (`GameMeta`), its timers and keys live in Redis
with no TTL, and the abandon sweep ends a room after 5 minutes without its
host. A test lives for days, has no host present, and needs nothing in real
time.

## Decision

1. **A separate REST mode on Postgres** (`apps/server/src/modules/solo`), not
   a pacing strategy: `SoloTest` (a snapshot of the quiz's playable questions
   as `LiveQuestion[]`, an optional `closesAt`, a `practice` flag),
   `SoloAttempt` (one per guest player and test: the open question's index and
   start time, score, correct count) and `SoloAnswer` (one per question;
   `answer` null = time ran out; a unique index makes the first write win).
2. **The live game's rules, reused as pure functions** (`solo-core.ts`):
   the question handlers (`checkAnswer`, `scoreAnswer`, `summarizeAnswers`),
   `resolveAnswerTiming` with its grace and `computeScore`. Time is measured
   by the server from the attempt's own `qStartAt`; a reload gets the time
   that is left, never a fresh clock. A question whose time ran out is stored
   as missed when the attempt is next read.
3. **The player screens are the live game's.** The server answers in the
   socket contract's shapes (`PublicQuestion`, `AnswerResultPayload`,
   `QuestionEndPayload`, as `SoloView`); `/solo/[code]` applies them to the
   same redux slice with `applySync`, and `Question` takes an answer sender
   instead of a socket. The result screen gets a "Next" slot.
4. **The host's report** (`GET /solo-tests/:id/report`) is computed from the
   answers with the same `questionStats` the live game's result stores, and
   rendered by the same `Report` component (standings, questions, CSV).
5. **Practice** ("Play alone" on the quiz page) is a test with
   `practice: true`: not listed, replaced by the next practice run of the same
   quiz.
6. Only the public info endpoint is rate limited by IP; playing uses the
   guest player JWT (a class shares one school IP).

## Consequences

- No Redis, sockets, timers or sweeps for tests; a test's lifetime is a row.
- A test's questions don't follow later quiz edits (by design: everyone plays
  the same test).
- Guest player tokens last 7 days (ADR-005); a player whose token expires
  mid-test starts a new attempt under a new profile.
- No sound, reactions or live leaderboard in tests.
- `core/pacing.ts` keeps two strategies; self-paced play is this mode.
