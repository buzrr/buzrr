import path from "node:path";
import { defineConfig } from "prisma/config";
import { loadEnv } from "./src/loadEnv";

loadEnv();

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL must be set");

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "schema.prisma"),
  datasource: {
    url: connectionString,
  },
  migrate: {
    async adapter() {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      return new PrismaPg({ connectionString });
    },
  },
});
