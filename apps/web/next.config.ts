import type { NextConfig } from "next";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const withBundleAnalyzer = (() => {
  try {
    const bundleAnalyzer = require("@next/bundle-analyzer");
    return bundleAnalyzer({
      enabled: process.env.ANALYZE === "true",
    });
  } catch {
    return (config: NextConfig) => config;
  }
})();

const nextConfig: NextConfig = {
  // Required for Vercel: standalone output includes only needed deps (reduces deploy size/failures).
  output: "standalone",
  // Monorepo: trace server deps from repo root so Prisma and workspace packages resolve.
  outputFileTracingRoot: path.join(__dirname, "../../"),
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
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  transpilePackages: ["@buzrr/prisma"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default withBundleAnalyzer(nextConfig);
