"use client";

import { useEffect } from "react";
import { useAppSelector } from "@/state/hooks";
import { PageTheme } from "@/state/pageThemeSlice";
import { useEffectiveTheme } from "@/hooks/useRenderedTheme";

/**
 * Keeps `<html class="dark">` in step with the effective theme — on every
 * page, toggle or not. The first paint is set by `THEME_INIT_SCRIPT`
 * (lib/theme-init.ts); until the stored choice is restored, that stays.
 */
export default function ThemeSync() {
  const theme = useEffectiveTheme();
  const restored = useAppSelector((state) => state._persist?.rehydrated);
  useEffect(() => {
    if (!restored) return;
    document.documentElement.classList.toggle("dark", theme === PageTheme.dark);
  }, [theme, restored]);
  return null;
}
