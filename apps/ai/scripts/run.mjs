#!/usr/bin/env node
/**
 * Runs a Python tool from this workspace's virtualenv.
 *
 * Exists so `yarn dev` / `yarn check-types` at the repo root work without anyone
 * activating a venv, and so a missing venv produces a one-line fix instead of a
 * confusing "command not found".
 *
 * CI does not use this — the python-ai job installs into the runner's Python and
 * invokes the tools directly.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const venvBin = join(root, ".venv", "bin");
const [tool, ...args] = process.argv.slice(2);

if (!tool) {
  console.error("usage: run.mjs <tool> [args...]");
  process.exit(2);
}

const executable = join(venvBin, tool);
if (!existsSync(executable)) {
  console.error(
    existsSync(venvBin)
      ? `apps/ai: "${tool}" is not installed in .venv — run: yarn workspace ai setup`
      : `apps/ai: no virtualenv found — run: yarn workspace ai setup`,
  );
  process.exit(1);
}

spawn(executable, args, { stdio: "inherit", cwd: root }).on(
  "exit",
  (code, signal) => {
    process.exit(signal ? 1 : (code ?? 0));
  },
);
