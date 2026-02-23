import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Required for Vercel: standalone output includes only needed deps (reduces deploy size/failures).
  output: "standalone",
  // Monorepo: trace server deps from repo root so Prisma and workspace packages resolve.
  outputFileTracingRoot: path.join(__dirname, "../../"),
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
