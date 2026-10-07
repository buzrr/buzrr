import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";
import { fileURLToPath } from "url";

/**
 * Self-hosted installs keep question images on the API's own disk
 * (STORAGE_DRIVER=local) and often serve it over plain http on a LAN. Allow
 * exactly that origin — not every http host.
 */
function selfHostedImageOrigins(): RemotePattern[] {
  const origins = [process.env.NEXT_PUBLIC_API_URL, process.env.MEDIA_ORIGIN];
  return origins.flatMap((raw) => {
    if (!raw) return [];
    try {
      const url = new URL(raw);
      if (url.protocol !== "http:") return [];
      return [
        {
          protocol: "http",
          hostname: url.hostname,
          ...(url.port ? { port: url.port } : {}),
        } satisfies RemotePattern,
      ];
    } catch {
      return [];
    }
  });
}

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  outputFileTracingExcludes: {
    "*": [
      "**/__tests__/**",
      "**/*.test.*",
      "**/*.spec.*",
      "**/.next/cache/**",
      "**/coverage/**",
      "**/*.log",
    ],
  },
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "better-auth",
    "kysely",
  ],
  transpilePackages: ["@buzrr/prisma", "@buzrr/contract"],
  // App screens are never search results. Their layouts also set a robots
  // meta tag, but on dynamic routes Next streams metadata via JS for most
  // crawlers — the header works without JS.
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      "/admin",
      "/admin/:path*",
      "/player",
      "/player/:path*",
      "/duel",
      "/duel/:path*",
      "/join/:path*",
      "/auth/:path*",
      "/billing/:path*",
    ].map((source) => ({ source, headers: noindex }));
  },
  images: {
    // In Docker the API's public URL (what browsers use) isn't reachable from
    // inside the web container, so the optimizer can't fetch from it; the
    // self-host image sets this and lets browsers load images directly.
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === "1",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      ...selfHostedImageOrigins(),
    ],
  },
};

export default nextConfig;
