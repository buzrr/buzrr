#!/usr/bin/env node
/**
 * One-command local bootstrap for Buzrr.
 *
 *   yarn setup
 *
 * What it does:
 *   1. Creates .env files from the local Docker defaults. Existing files are
 *      never overwritten — but if one is missing a key the apps can't run
 *      without (DB/Redis URLs, auth secret, public API URLs), the local
 *      default is appended. Safe to re-run at any time.
 *   2. Starts the Postgres + Redis containers (docker compose up -d).
 *   3. Waits for Postgres to accept connections.
 *   4. Pushes the Prisma schema into the fresh database (prisma db push).
 *
 * After it finishes you only need to drop your Google OAuth credentials into
 * apps/web/.env, then run `yarn dev`. Everything else is optional.
 *
 * Cross-platform: pure Node, no bash-isms.
 */
import { randomBytes } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// tiny console helpers
// ---------------------------------------------------------------------------
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};
const step = (m) => console.log(`\n${c.cyan}${c.bold}▸ ${m}${c.reset}`);
const ok = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const info = (m) => console.log(`  ${c.dim}${m}${c.reset}`);
const warn = (m) => console.log(`${c.yellow}!${c.reset} ${m}`);
const die = (m) => {
  console.error(`\n${c.red}✗ ${m}${c.reset}\n`);
  process.exit(1);
};

// ---------------------------------------------------------------------------
// local Docker connection strings (match docker-compose.yml)
// ---------------------------------------------------------------------------
const LOCAL_DATABASE_URL = "postgresql://buzrr:buzrr@localhost:5432/buzrr";
const LOCAL_REDIS_URL = "redis://localhost:6379";

/** Reuse an existing BETTER_AUTH_SECRET if one of the env files already has one
 *  (web + server must share it), otherwise mint a new one. */
function resolveAuthSecret() {
  for (const rel of ["apps/web/.env", "apps/server/.env"]) {
    const p = join(ROOT, rel);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(/^BETTER_AUTH_SECRET\s*=\s*"?([^"\n]+)"?/m);
    if (m && m[1].trim()) return m[1].trim();
  }
  return randomBytes(32).toString("base64");
}

const AUTH_SECRET = resolveAuthSecret();

const ENV_FILES = {
  ".env": `# Local Docker Postgres (see docker-compose.yml).
# Consumed by the Prisma CLI and Turborepo at the repo root.
DATABASE_URL="${LOCAL_DATABASE_URL}"
DIRECT_URL="${LOCAL_DATABASE_URL}"
`,

  "apps/server/.env": `# --- NestJS API (http + Socket.IO on one port) ---
PORT=3001
WEB_ORIGIN=http://localhost:3000

# Must match apps/web/.env — the web app signs JWTs the API verifies.
BETTER_AUTH_SECRET="${AUTH_SECRET}"

# Local Docker services (see docker-compose.yml)
DATABASE_URL="${LOCAL_DATABASE_URL}"
DIRECT_URL="${LOCAL_DATABASE_URL}"
REDIS_URL="${LOCAL_REDIS_URL}"

# --- Optional ---
# AI quiz generation (https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=""
# Image uploads (https://cloudinary.com)
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
# Rate limiting — only used when RATELIMIT=ON in apps/web/.env
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
`,

  "apps/web/.env": `# --- Next.js web app (hosts Better Auth) ---
BETTER_AUTH_URL="http://localhost:3000"
TRUSTED_ORIGINS="http://localhost:3000,http://localhost:3001"

# Must match apps/server/.env
BETTER_AUTH_SECRET="${AUTH_SECRET}"

# REQUIRED for signup/login — create at https://console.cloud.google.com
# Authorized redirect URI: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Local Docker Postgres (see docker-compose.yml)
DATABASE_URL="${LOCAL_DATABASE_URL}"
DIRECT_URL="${LOCAL_DATABASE_URL}"

# Where the browser reaches the NestJS API (no /api suffix)
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
NEXT_PUBLIC_API_URL="http://localhost:3001"

# --- Optional ---
# AI quiz generation (https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=""
# Rate limiting: ON | OFF
RATELIMIT="OFF"
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
`,
};

// ---------------------------------------------------------------------------
// 0. preflight
// ---------------------------------------------------------------------------
function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}
function tryRun(cmd) {
  try {
    execSync(cmd, { stdio: "ignore", cwd: ROOT });
    return true;
  } catch {
    return false;
  }
}

step("Checking prerequisites");
if (!tryRun("docker --version")) {
  die("Docker is not installed or not on PATH. Install Docker Desktop: https://docs.docker.com/get-docker/");
}
if (!tryRun("docker compose version")) {
  die("`docker compose` is unavailable. Update to Docker Compose v2 (bundled with Docker Desktop).");
}
if (!tryRun("docker info")) {
  die("The Docker daemon isn't running. Start Docker Desktop and re-run `yarn setup`.");
}
ok("Docker is ready");

// ---------------------------------------------------------------------------
// 1. env files
// ---------------------------------------------------------------------------
step("Writing .env files (existing values are never overwritten)");

/** Keys `yarn dev` cannot run without; healed with local Docker defaults when
 *  an existing .env is missing them. */
const REQUIRED_LOCAL_KEYS = {
  ".env": { DATABASE_URL: LOCAL_DATABASE_URL, DIRECT_URL: LOCAL_DATABASE_URL },
  "apps/server/.env": {
    DATABASE_URL: LOCAL_DATABASE_URL,
    DIRECT_URL: LOCAL_DATABASE_URL,
    REDIS_URL: LOCAL_REDIS_URL,
    BETTER_AUTH_SECRET: AUTH_SECRET,
  },
  "apps/web/.env": {
    DATABASE_URL: LOCAL_DATABASE_URL,
    DIRECT_URL: LOCAL_DATABASE_URL,
    BETTER_AUTH_SECRET: AUTH_SECRET,
    BETTER_AUTH_URL: "http://localhost:3000",
    TRUSTED_ORIGINS: "http://localhost:3000,http://localhost:3001",
    // The browser can't reach the API without these (lib/api/client.ts throws).
    NEXT_PUBLIC_SOCKET_URL: "http://localhost:3001",
    NEXT_PUBLIC_API_URL: "http://localhost:3001",
  },
};

// A key counts as set only if it has a non-empty value (KEY="" is missing).
const hasKey = (text, key) => {
  const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, "m"));
  if (!m) return false;
  return m[1].trim().replace(/^["']|["']$/g, "").trim() !== "";
};

let createdAny = false;
for (const [rel, contents] of Object.entries(ENV_FILES)) {
  const p = join(ROOT, rel);
  const existing = existsSync(p) ? readFileSync(p, "utf8") : null;

  // Missing or effectively empty → write the full template.
  if (existing === null || existing.trim() === "") {
    writeFileSync(p, contents);
    ok(`created ${rel}`);
    createdAny = true;
    continue;
  }

  // Exists with content → keep it, but append any required keys it lacks
  // (e.g. after removing production DB URLs) so local dev still works.
  const missing = Object.entries(REQUIRED_LOCAL_KEYS[rel] ?? {}).filter(
    ([key]) => !hasKey(existing, key),
  );
  if (missing.length === 0) {
    info(`kept existing ${rel}`);
    continue;
  }
  const patch =
    `\n# --- Added by \`yarn setup\` (local Docker defaults for missing keys) ---\n` +
    missing.map(([k, v]) => `${k}="${v}"`).join("\n") +
    "\n";
  writeFileSync(p, existing.replace(/\n*$/, "\n") + patch);
  ok(`updated ${rel} — added missing ${missing.map(([k]) => k).join(", ")}`);
}
if (createdAny) info(`Generated a shared BETTER_AUTH_SECRET for local dev.`);

// ---------------------------------------------------------------------------
// 2. start containers
// ---------------------------------------------------------------------------
step("Starting Postgres + Redis containers");
run("docker compose up -d");

// ---------------------------------------------------------------------------
// 3. wait for Postgres
// ---------------------------------------------------------------------------
step("Waiting for Postgres to be ready");
const DEADLINE = Date.now() + 60_000;
let ready = false;
while (Date.now() < DEADLINE) {
  const r = spawnSync(
    "docker",
    ["compose", "exec", "-T", "postgres", "pg_isready", "-U", "buzrr", "-d", "buzrr"],
    { cwd: ROOT, stdio: "ignore" },
  );
  if (r.status === 0) {
    ready = true;
    break;
  }
  execSync(process.platform === "win32" ? "timeout /t 1 >nul" : "sleep 1");
}
if (!ready) die("Postgres did not become ready within 60s. Check `docker compose logs postgres`.");
ok("Postgres is accepting connections");

// ---------------------------------------------------------------------------
// 4. push schema
// ---------------------------------------------------------------------------
// prisma.config.ts resolves DIRECT_URL while the config file loads, so it must
// be present in the process env even though --url pins the actual target.
const prismaEnv = {
  ...process.env,
  DATABASE_URL: LOCAL_DATABASE_URL,
  DIRECT_URL: LOCAL_DATABASE_URL,
};

step("Pushing the Prisma schema into the database");
try {
  // --url pins the target to the local container, independent of any .env.
  run(`yarn prisma db push --url "${LOCAL_DATABASE_URL}"`, { env: prismaEnv });
} catch {
  die("`prisma db push` failed. Ensure dependencies are installed (`yarn install`).");
}
ok("Database is in sync with the Prisma schema");

step("Generating the Prisma client");
run("yarn prisma:generate", { env: prismaEnv });
ok("Prisma client generated");

// ---------------------------------------------------------------------------
// done
// ---------------------------------------------------------------------------
console.log(`\n${c.green}${c.bold}✓ Local environment is ready.${c.reset}\n`);
console.log(`${c.bold}Next steps:${c.reset}`);
console.log(
  `  1. Add your Google OAuth credentials to ${c.cyan}apps/web/.env${c.reset}` +
    ` (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).`,
);
console.log(`     ${c.dim}Redirect URI: http://localhost:3000/api/auth/callback/google${c.reset}`);
console.log(`  2. Run ${c.cyan}yarn dev${c.reset} — web on :3000, API on :3001.`);
console.log(
  `\n${c.dim}Optional: add GEMINI_API_KEY (AI quiz generation) or CLOUDINARY_* (image uploads) later.${c.reset}\n`,
);
