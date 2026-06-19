import tailwindcss from "@tailwindcss/vite";
import vinext from "vinext";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const serverExternals = [
  "@prisma/client",
  "@prisma/adapter-pg",
  "better-auth",
  "kysely",
  "pg",
];

export default defineConfig({
  plugins: [
    vinext(),
    nitro({
      // Keep node_modules external in the final Nitro bundle (vinext clears
      // SSR externals when Nitro is present; without this, Rolldown re-bundles
      // packages like better-auth/kysely and fails on CJS interop).
      noExternals: false,
    }),
    tailwindcss(),
  ],
  optimizeDeps: {
    exclude: ["better-auth"],
  },
  ssr: {
    external: serverExternals,
  },
});
