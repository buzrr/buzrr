import "server-only";

export const GITHUB_REPO = "buzrr/buzrr";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

const API_BASE = "https://api.github.com";
const REVALIDATE_SECONDS = 3600;

export interface GithubStats {
  contributors: number | null;
  commits: number | null;
  mergedPRs: number | null;
  stars: number | null;
}

const fetchOptions: RequestInit & { next: { revalidate: number } } = {
  headers: {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  },
  next: { revalidate: REVALIDATE_SECONDS },
};

/**
 * Total item count for a paginated list endpoint without downloading every
 * page: request one item per page and read the last page number from the
 * `Link` header. Endpoints with a single page return no `Link` header, so
 * fall back to the returned array length.
 */
async function countViaLinkHeader(path: string): Promise<number | null> {
  const res = await fetch(`${API_BASE}${path}`, fetchOptions);
  if (!res.ok) return null;

  const link = res.headers.get("link");
  const lastPage = link?.match(/[?&]page=(\d+)>;\s*rel="last"/);
  if (lastPage) return Number(lastPage[1]);

  const items: unknown = await res.json();
  return Array.isArray(items) ? items.length : null;
}

async function fetchStars(): Promise<number | null> {
  const res = await fetch(`${API_BASE}/repos/${GITHUB_REPO}`, fetchOptions);
  if (!res.ok) return null;
  const repo: { stargazers_count?: number } = await res.json();
  return repo.stargazers_count ?? null;
}

async function fetchMergedPRs(): Promise<number | null> {
  const res = await fetch(
    `${API_BASE}/search/issues?q=repo:${GITHUB_REPO}+type:pr+is:merged&per_page=1`,
    fetchOptions,
  );
  if (!res.ok) return null;
  const data: { total_count?: number } = await res.json();
  return data.total_count ?? null;
}

export async function getGithubStats(): Promise<GithubStats> {
  const swallow = (p: Promise<number | null>) => p.catch(() => null);

  const [contributors, commits, mergedPRs, stars] = await Promise.all([
    swallow(
      countViaLinkHeader(
        `/repos/${GITHUB_REPO}/contributors?per_page=1&anon=1`,
      ),
    ),
    swallow(countViaLinkHeader(`/repos/${GITHUB_REPO}/commits?per_page=1`)),
    swallow(fetchMergedPRs()),
    swallow(fetchStars()),
  ]);

  return { contributors, commits, mergedPRs, stars };
}
