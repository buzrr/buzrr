// Next.js uses PostCSS for Tailwind; Vite uses @tailwindcss/vite and opts out
// of this file with an inline `css.postcss` in vite.config.ts, so stylesheets
// aren't double-processed by the Oxide engine.
const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;
