let cache: { token: string; expiresAt: number } | null = null;

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_BEFORE_MS = 60_000;

export async function fetchApiAccessToken(): Promise<string | null> {
  if (
    cache &&
    Date.now() < cache.expiresAt - REFRESH_BEFORE_MS
  ) {
    return cache.token;
  }

  const res = await fetch("/api/auth/access-token", {
    credentials: "include",
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as { token: string };
  cache = {
    token: data.token,
    expiresAt: Date.now() + TTL_MS,
  };
  return data.token;
}

export function clearApiAccessTokenCache(): void {
  cache = null;
}
