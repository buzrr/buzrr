import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "packages/prisma/schema.prisma",
  migrations: {
    path: "packages/prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
