let cache: { token: string; expiresAt: number } | null = null;
// Callers that arrive while a fetch is in flight share it, so a page mounting
// several queries at once costs one /api/auth/access-token call, not one each.
let inflight: Promise<string | null> | null = null;

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_BEFORE_MS = 60_000;

export async function fetchApiAccessToken(): Promise<string | null> {
  if (cache && Date.now() < cache.expiresAt - REFRESH_BEFORE_MS) {
    return cache.token;
  }

  inflight ??= requestToken().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function requestToken(): Promise<string | null> {
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
  inflight = null;
}
