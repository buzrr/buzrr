# @buzrr/prisma

Shared Prisma schema, generated client, and database helpers for the Buzrr monorepo.

## Setup

- **`DATABASE_URL`** must be set in the environment. The package loads `.env` from the monorepo root and from the current working directory (so you can use root `.env` or `apps/server` / `apps/web` `.env`). App-level `.env` overrides root.
- **Migrations** are run from the repo root and use `prisma.config.ts` (e.g. `DIRECT_URL` for the migration connection).

## Usage

From `apps/server` or `apps/web`:

```ts
import { prisma, connectDatabase, PrismaClient, GameStates } from "@buzrr/prisma";
```

## Scripts

- `yarn prisma:generate` (from root) – generates the client into `./generated/client`.
- `yarn build` (in this package) – compiles `src/` to `dist/` for Node.
