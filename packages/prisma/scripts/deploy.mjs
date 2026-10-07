/**
 * Brings a database up to the current schema — on a brand-new install as well
 * as on one that has been running for years. Run from packages/prisma:
 *
 *   yarn deploy            (the self-host `migrate` container runs this)
 *
 * Why not just `prisma migrate deploy`: the committed history starts from a
 * database that already existed (the first migration alters `users`, which no
 * migration creates), so it cannot be replayed onto an empty database.
 *
 * - Migration history present (hosted production, any install this script
 *   already set up) → plain `migrate deploy`.
 * - No history (a fresh install, or a dev database made with `db push`) →
 *   `db push` creates/syncs the current schema (refusing anything that would
 *   lose data), every committed migration is recorded as applied — Prisma's
 *   documented "baselining" — and then `migrate deploy` has nothing left to
 *   do. From then on upgrades follow the same migrations as production.
 *
 * The `ai` schema is not touched: Alembic owns it (invariant #30).
 */
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma, connectDatabase } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const migrationsDir = join(pkg, "migrations");

const prismaCli = (...args) =>
  execFileSync("node", [require_resolve_prisma(), ...args], {
    cwd: pkg,
    stdio: "inherit",
  });

function require_resolve_prisma() {
  // The CLI's entry point, wherever the workspace hoisted it.
  for (const base of [pkg, join(pkg, "../..")]) {
    const candidate = join(base, "node_modules/prisma/build/index.js");
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* try the next */
    }
  }
  throw new Error("Prisma CLI not found — install dependencies first");
}

await connectDatabase();
const [{ hasHistory }] = await prisma.$queryRaw`
  SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS "hasHistory"
`;
await prisma.$disconnect();

if (!hasHistory) {
  console.log("No migration history: creating the schema and baselining.");
  prismaCli("db", "push");
  const migrations = readdirSync(migrationsDir)
    .filter((name) => statSync(join(migrationsDir, name)).isDirectory())
    .sort();
  for (const name of migrations) {
    prismaCli("migrate", "resolve", "--applied", name);
  }
}

prismaCli("migrate", "deploy");
