# @buzrr/contract

The one definition of what Buzrr's apps say to each other: zod schemas for the
Socket.IO contract, the per-question-type shapes, and the REST bodies that
carry questions. Types are inferred from the schemas, so `apps/server` and
`apps/web` compile against exactly the same shapes
([ADR-013](../../docs/adr/013-shared-contract-package.md)).

| File                    | What's in it                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `src/socket.ts`         | Every socket payload + `ServerToClientEvents` / `ClientToServerEvents`.                    |
| `src/question-types.ts` | Per type: `config`, `answer`, `publicQuestion`, `summary` — and the unions over all types. |
| `src/rest.ts`           | Question-carrying REST bodies (`questionDefinitionSchema`, `importQuizSchema`).            |

Built to `dist/` (CommonJS) by its `postinstall`, so a plain `yarn install` is
enough; `yarn dev` keeps it rebuilding. Changing a shape here and running
`yarn check-types` shows every place in both apps that must follow — the
contract has exactly one version (ADR-002), so migrate both sides in the same
change.

Adding a question type: [CONTRIBUTING.md § Adding a question type](../../CONTRIBUTING.md#adding-a-question-type).
