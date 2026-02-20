import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
