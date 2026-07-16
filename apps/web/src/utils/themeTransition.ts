let timeoutId: number | undefined;

/**
 * Briefly enables CSS color transitions on the whole document so a theme
 * switch cross-fades instead of snapping. The class must be removed after
 * the transition ends, otherwise every hover/interaction animates too.
 */
export function withThemeTransition() {
  if (typeof document === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const root = document.documentElement;
  root.classList.add("theme-anim");
  window.clearTimeout(timeoutId);
  timeoutId = window.setTimeout(() => root.classList.remove("theme-anim"), 450);
}
