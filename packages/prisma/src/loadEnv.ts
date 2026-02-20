import path from "path";
import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";

/**
 * Load .env from monorepo root and then from cwd so that DATABASE_URL
 * can live in root .env or in apps/server / apps/web .env.
 * App-level .env overrides root (cwd is loaded after root).
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
  const root = findMonorepoRoot();
  if (root) {
    const rootEnv = path.join(root, ".env");
    if (existsSync(rootEnv)) config({ path: rootEnv });
  }
  config({ override: true }); // cwd .env overrides root
}
