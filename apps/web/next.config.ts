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
