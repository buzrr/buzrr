"use client";

import { useSyncExternalStore } from "react";
import { useAppSelector } from "@/state/hooks";
import { PageTheme } from "@/state/pageThemeSlice";

const noopSubscribe = () => () => {};

/**
 * The page theme for rendering: the stored theme, but light — what the server
 * rendered — until hydration is done. redux-persist restores the stored theme
 * on the client before React hydrates, so reading it directly makes the first
 * client render (logo, sun/moon icon) disagree with the server HTML. After
 * hydration React re-renders with the real theme.
 */
export function useRenderedTheme(): PageTheme {
  const theme = useAppSelector((state) => state.pageTheme.theme);
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return hydrated ? theme : PageTheme.light;
}
