import type { NextConfig } from "next";
import { fileURLToPath } from "url";

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
  transpilePackages: ["@buzrr/prisma"],
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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
