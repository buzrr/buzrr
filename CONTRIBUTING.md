# Contributing to Buzrr

Thanks for taking the time to contribute! 🎉 This guide covers everything you
need to get productive.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By
participating, you agree to uphold it. Please report unacceptable behavior to
the maintainers.

## Getting started

You'll need **Node ≥ 18** (20 LTS recommended) and **Docker**.

All changes come in as pull requests from forks — direct pushes to this
repository are not accepted. Start by **forking the repo** on GitHub, then
clone **your fork**:

```sh
git clone https://github.com/<your-username>/buzrr.git
cd buzrr
corepack enable          # enable the pinned Yarn 4
yarn install
yarn setup               # Postgres + Redis in Docker, .env files, schema
```

Add your Google OAuth credentials to `apps/web/.env` (see the
[README](README.md#quick-start)), then:

```sh
yarn dev                 # web :3000, api :3001
```

## Development workflow

1. In your fork's clone, create a branch from `main`:
   `git checkout -b feat/short-description`.
2. Make your change. Keep it focused — one logical change per PR.
3. Run the checks locally (a `pre-commit` hook runs `yarn lint` + `yarn check-types`
   automatically):

   ```sh
   yarn lint
   yarn check-types
   yarn build          # optional but recommended — this is what CI runs
   yarn format         # apply Prettier
   ```

4. Commit, **push the branch to your fork**, and open a Pull Request from it
   against this repository's `main`.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org):

```text
feat: add ranked duel matchmaking
fix: prevent double-join on reconnect
refactor: server owns the game loop
docs: document local Docker setup
chore: bump prisma to 7.4
```

Common types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `ci`.

## Coding standards

- **TypeScript everywhere.** No new `any` unless truly unavoidable.
- **ESLint + Prettier** are the source of truth — run `yarn format` before pushing.
- **Match the surrounding code** — naming, structure, and comment density.
- **Database changes** go through Prisma. Edit
  [`packages/prisma/schema.prisma`](packages/prisma/schema.prisma); for local dev
  use `yarn db:push`, and add a migration under
  `packages/prisma/migrations` for anything headed to production.
- **Secrets never get committed.** `.env*` files are gitignored — only update the
  `.env.example` templates.

## Pull request checklist

- [ ] `yarn lint`, `yarn check-types`, and `yarn build` pass.
- [ ] The change is covered by the PR description (what & why).
- [ ] Docs/README updated if behavior or setup changed.
- [ ] No secrets, credentials, or personal data in the diff.

CI (lint, type-check, build) must be green before a PR can be merged. Thanks
again for contributing! 💛
