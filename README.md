# Buzrr

Yarn workspaces monorepo managed with [Turborepo](https://turbo.build/repo).

## Apps and packages

- `apps/web`: Next.js app
- `apps/server`: NestJS API
- `@buzrr/prisma`: Prisma schema and shared client
- `@repo/eslint-config`: ESLint presets
- `@repo/typescript-config`: shared `tsconfig` bases

## Scripts

From the repository root:

```sh
yarn dev          # all apps (turbo)
yarn dev:web      # web only
yarn dev:server   # server only
yarn build
yarn lint
yarn check-types
```

## Useful links

- [Turborepo tasks](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks)
- [Turborepo caching](https://turbo.build/repo/docs/core-concepts/caching)
