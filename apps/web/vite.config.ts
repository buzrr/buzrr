import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vinext()],
  optimizeDeps: {
    exclude: ["better-auth"],
  },
  ssr: {
    external: ["better-auth"],
  },
});
