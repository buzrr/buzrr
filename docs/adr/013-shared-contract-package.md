# ADR-013: One shared contract package (`@buzrr/contract`)

**Status:** Accepted — supersedes the hand-kept mirror described in
invariant #25.

## Context

The socket contract was defined twice: `realtime.types.ts` on the server and
a hand-copied `apps/web/src/types/socket-events.ts`, with nothing enforcing
that they matched (`docs/CONTEXT.md` known debt #2). They had already
drifted (`avgTimeMs` required on one side, optional on the other). Pluggable
question types (ADR-011) multiply the shapes that must agree.

## Decision

`packages/contract` (`@buzrr/contract`) holds zod schemas for every socket
payload, the per-question-type shapes, and the REST bodies that carry
questions. Types are inferred from the schemas; `ServerToClientEvents` /
`ClientToServerEvents` are declared once, over those types.

- The server re-exports the contract from `realtime.types.ts` (adding only
  socket plumbing like `SocketData`), validates `submit-answer` with
  `submitAnswerSchema`, and validates `POST /api/quizzes/import` with
  `importQuizSchema` through `ZodValidationPipe`.
- The web imports payload types straight from the package; the mirror file
  is deleted. Client-only socket types live in `apps/web/src/types/socket.ts`.
- Built like `@buzrr/prisma` (CommonJS to `dist/`), but its `postinstall`
  compiles it, so a fresh `yarn install` is enough for `dev`, `check-types`
  and CI.

## Consequences

- A contract change is one edit; both apps then fail to compile until they
  follow it.
- Other REST endpoints still use class-validator DTOs; moving them is
  incremental (the pipe and the global `ValidationPipe` coexist).
- The web bundles zod schemas only where it imports runtime values — today it
  imports types only.

## Evidence

`packages/contract/src/`, `apps/server/src/common/pipes/zod-validation.pipe.ts`,
`apps/server/src/modules/realtime/realtime.types.ts`,
`apps/web/src/types/socket.ts`.
