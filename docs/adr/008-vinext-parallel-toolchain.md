# ADR-008: Parallel vinext/Vite toolchain alongside the Next CLI

**Status:** Adopted but non-default; end-state unresolved

## Context

PR #10 (`4c6fea6 "feat: vinext migration"`) introduced
[vinext](https://github.com/cloudflare/vinext) — a Vite-based reimplementation
of the Next.js API surface — into `apps/web`.

## Decision (as it stands in the tree)

- `apps/web/vite.config.ts` configures vinext + Nitro + Tailwind, with SSR
  externals for prisma/pg/better-auth (the `noExternals: false` comment
  documents a CJS-interop constraint).
- Package scripts expose both paths: default `dev`/`build`/`start` run the
  **Next CLI**; `dev:vinext`/`build:vinext`/`start:vinext`/`build:vercel`
  (`vite build`) run the vinext path.
- The migration skill is vendored at `.agents/skills/migrate-to-vinext/`
  (pinned in `skills-lock.json`).
- CI builds with `yarn build` (Next). `.gitignore` covers `.vinext/`.

## Rationale

**Not recorded in the repo.** The commit/PR title says only "vinext
migration". Do not assume a motive (cost, speed, Cloudflare deployment…)
without asking a maintainer.

## Consequences

- Two build pipelines must keep working; changes to `next.config.ts`,
  server-external packages, or auth/prisma imports should be sanity-checked
  against `vite.config.ts` too.
- Which pipeline the production Vercel deployment actually uses is **not
  determinable from the repo** (no `vercel.json`; local `.vercel/output`
  artifacts are untracked). Treat the Next CLI as canonical until a
  maintainer confirms otherwise.

## Evidence

`apps/web/vite.config.ts`; `apps/web/package.json` scripts; commit `4c6fea6`;
`.agents/skills/migrate-to-vinext/`; `skills-lock.json`;
`.github/workflows/ci.yml` (builds via `yarn build`).
