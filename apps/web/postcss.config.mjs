const isNextJs = process.argv.some((arg) =>
  /(?:^|[\\/])next(?:$|[\\/.])/.test(arg),
);

const config = {
  // Next.js uses PostCSS for Tailwind; Vite uses @tailwindcss/vite in vite.config.ts.
  // Running both would double-process stylesheets via the Oxide engine.
  plugins: isNextJs ? ["@tailwindcss/postcss"] : [],
};

export default config;
