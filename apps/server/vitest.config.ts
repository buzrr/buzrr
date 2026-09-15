import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    // The billing specs share one Postgres; running files in parallel would
    // only add lock contention, not coverage.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
