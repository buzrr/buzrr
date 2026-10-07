# @buzrr/prisma

Shared Prisma schema, generated client, and database helpers for the Buzrr monorepo.

## Setup

- **`DATABASE_URL`** must be set in the environment. The package loads `.env` from the monorepo root and from the current working directory (so you can use root `.env` or `apps/server` / `apps/web` `.env`). App-level `.env` overrides root.
- **Migrations** are run from the repo root and use `prisma.config.ts` (e.g. `DIRECT_URL` for the migration connection).

## Usage

From `apps/server` or `apps/web`:

```ts
import {
  prisma,
  connectDatabase,
  PrismaClient,
  GameStates,
} from "@buzrr/prisma";
```

## Scripts

- `yarn prisma:generate` (from root) – generates the client into `./generated/client`.
- `yarn build` (in this package) – compiles `src/` to `dist/` for Node.
- `yarn deploy` (in this package) – brings any database to the current schema:
  `migrate deploy`, after first creating and baselining the schema when the
  database has no migration history (a fresh self-hosted install). See
  `scripts/deploy.mjs`.
- `yarn migrate:deploy` – plain `prisma migrate deploy` (hosted production).
- `yarn seed:duel` – idempotent "Duel Starter Pack" so the duel pool isn't empty.
