import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Last-commit dates for sitemap `lastModified`, read from git at build time.
 * Answers `undefined` rather than guess: file mtimes are checkout times in CI
 * and Docker, and a shallow clone's boundary commit "adds" every file, so a
 * file last touched before the cut-off would look brand new.
 */

function git(args: string[]): string {
  return execFileSync("git", ["--literal-pathspecs", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

let boundaries: Set<string> | null | undefined;

/** Shallow-clone boundary commits; `null` when git is unavailable. */
function shallowBoundaries(): Set<string> | null {
  if (boundaries !== undefined) return boundaries;
  try {
    const file = git(["rev-parse", "--git-path", "shallow"]);
    let lines: string[] = [];
    try {
      lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
    } catch {
      // No shallow file: full history.
    }
    boundaries = new Set(lines);
  } catch {
    boundaries = null; // No git (e.g. the Docker build context excludes .git).
  }
  return boundaries;
}

/**
 * Date of the newest commit touching any of `files` (paths relative to
 * `apps/web/src`, the build's working directory being `apps/web`).
 */
export function lastCommitDate(files: string[]): Date | undefined {
  const shallow = shallowBoundaries();
  if (!shallow || files.length === 0) return undefined;
  try {
    const out = git([
      "log",
      "-1",
      "--format=%H %cI",
      "--",
      ...files.map((f) => `src/${f}`),
    ]);
    if (!out) return undefined;
    const [sha, date] = out.split(" ");
    return shallow.has(sha) ? undefined : new Date(date);
  } catch {
    return undefined;
  }
}
