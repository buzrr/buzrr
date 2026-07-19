/**
 * Full-screen loader rendered by route-level loading.tsx boundaries so
 * navigation paints immediately while server components (auth checks,
 * data fetches) resolve.
 */
export function RouteLoader() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-light-bg dark:bg-dark-bg">
      <div className="size-10 rounded-full border-4 border-card-light dark:border-card-dark border-t-lprimary dark:border-t-dprimary animate-spin" />
      <p className="text-sm font-semibold text-dark/60 dark:text-gray">
        Loading…
      </p>
    </div>
  );
}

/**
 * Loader for a page's content area only — used by loading boundaries that
 * keep static chrome (e.g. the admin sidebar) visible during navigation.
 */
export function ContentLoader() {
  return (
    <div className="w-full flex flex-col items-center justify-center gap-4 py-40">
      <div className="size-10 rounded-full border-4 border-card-light dark:border-card-dark border-t-lprimary dark:border-t-dprimary animate-spin" />
      <p className="text-sm font-semibold text-dark/60 dark:text-gray">
        Loading…
      </p>
    </div>
  );
}

export default RouteLoader;
