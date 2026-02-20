import path from "path";
import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";

/**
 * Load .env from cwd first, then from monorepo root (no override).
 * Dotenv skips already-set keys by default, so: cwd values win over root,
 * and system env (Docker, K8s, CI) always keeps highest precedence.
 */
function findMonorepoRoot(): string | null {
  let dir = process.cwd();
  const stop = path.parse(dir).root;
  while (dir !== stop) {
    const pkgPath = path.join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const raw = readFileSync(pkgPath, "utf-8");
        const pkg = JSON.parse(raw) as { workspaces?: string[] };
        if (pkg.workspaces) return dir;
      } catch {
        // ignore
      }
    }
    dir = path.dirname(dir);
  }
  return null;
}

export function loadEnv(): void {
  config({ quiet: true }); // cwd .env first (no override — system env preserved)
  const root = findMonorepoRoot();
  if (root) {
    const rootEnv = path.join(root, ".env");
    if (existsSync(rootEnv)) config({ path: rootEnv, quiet: true }); // root fills in only unset keys
  }
}
