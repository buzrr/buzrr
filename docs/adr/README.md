# Architecture Decision Records

Concise records of significant, hard-to-reverse decisions. Reconstructed from
the codebase, code comments, migrations, and commit history on 2026-08-14 —
**where the original rationale is not recorded anywhere, the ADR says so
rather than inventing one.**

Format: Title · Status · Context · Decision · Consequences · Alternatives
(only when known) · Evidence.

| #                                               | Decision                                                                      | Status                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------- |
| [001](001-monorepo-two-apps.md)                 | Turborepo monorepo: Next.js web + NestJS realtime API + shared Prisma package | Accepted                            |
| [002](002-server-authoritative-loop-redis.md)   | Server-authoritative game loop with live state in Redis                       | Accepted                            |
| [003](003-auth-better-auth-jwt-bridge.md)       | Better Auth on the web app + shared-secret JWT bridge to the API              | Accepted                            |
| [004](004-multi-instance-redis-coordination.md) | Multi-instance coordination via Redis (socket adapter, locks, deadline set)   | Accepted                            |
| [005](005-ephemeral-guest-players.md)           | Ephemeral guest Player identities with player-typed JWTs                      | Accepted                            |
| [006](006-duels-elo-and-bots.md)                | ELO matchmaking with widening bands, bot fallback, unrated friend invites     | Accepted                            |
| [007](007-question-moderation-gate.md)          | Per-question moderation gate feeding the public duel pool                     | Accepted                            |
| [008](008-vinext-parallel-toolchain.md)         | Parallel vinext/Vite toolchain alongside the Next CLI                         | Adopted but non-default; unresolved |
| [009](009-buzrr-ai-rag-service.md)              | Separate Python service (Buzrr-AI) for document RAG                           | Accepted                            |
| [010](010-billing-and-entitlements.md)          | Buzrr Pro: Dodo subscriptions, webhook-verified, server-side entitlements     | Accepted                            |
| [011](011-pluggable-question-types.md)          | Pluggable question types: one server handler + one web renderer per type      | Accepted                            |
| [012](012-pure-engine-core-and-pacing.md)       | Pure engine core `(state, event, now) → (state, effects)`; pacing strategies  | Accepted                            |
| [013](013-shared-contract-package.md)           | One shared zod contract package for socket + REST shapes                      | Accepted                            |
| [014](014-self-hosting-without-saas.md)         | Self-hosting with no SaaS lock-in (storage, models, local accounts, compose)  | Accepted                            |

New ADRs: next number, same format, add a row here. Reversing a decision:
mark the old one "Superseded by NNN", don't delete it.
