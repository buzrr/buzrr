"use client";

import { useSyncExternalStore } from "react";
import { useAppSelector } from "@/state/hooks";
import { PageTheme } from "@/state/pageThemeSlice";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeDevice(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** The device's theme (light on the server). */
function useDeviceTheme(): PageTheme {
  const dark = useSyncExternalStore(
    subscribeDevice,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
  return dark ? PageTheme.dark : PageTheme.light;
}

/** The theme in effect: the stored choice, or the device's while none. */
export function useEffectiveTheme(): PageTheme.dark | PageTheme.light {
  const theme = useAppSelector((state) => state.pageTheme.theme);
  const device = useDeviceTheme();
  const shown = theme === PageTheme.system ? device : theme;
  return shown === PageTheme.dark ? PageTheme.dark : PageTheme.light;
}

const noopSubscribe = () => () => {};

/**
 * The page theme for rendering: the effective theme, but light — what the
 * server rendered — until hydration is done. redux-persist restores the
 * stored theme on the client before React hydrates, so reading it directly
 * makes the first client render (logo, sun/moon icon) disagree with the
 * server HTML. After hydration React re-renders with the real theme.
 */
export function useRenderedTheme(): PageTheme {
  const theme = useEffectiveTheme();
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return hydrated ? theme : PageTheme.light;
}
