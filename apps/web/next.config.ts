import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
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
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "better-auth"],
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

export default nextConfig;
