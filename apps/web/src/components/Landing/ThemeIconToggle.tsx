"use client";

import { LuMoon, LuSun } from "react-icons/lu";
import { useAppDispatch } from "@/state/hooks";
import { PageTheme, setPageTheme } from "@/state/pageThemeSlice";
import { withThemeTransition } from "@/utils/themeTransition";
import { useRenderedTheme } from "@/hooks/useRenderedTheme";

/** Compact sun/moon theme switch for the landing navbar. */
const ThemeIconToggle = () => {
  const dispatch = useAppDispatch();
  // What to draw. A toggle by hand is a choice, stored from then on (the
  // device's theme is followed until then).
  const shown = useRenderedTheme();

  const handler = () => {
    withThemeTransition();
    dispatch(
      setPageTheme(shown === PageTheme.dark ? PageTheme.light : PageTheme.dark),
    );
  };

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={handler}
      className="flex items-center justify-center size-9 rounded-full text-dark dark:text-white bg-card-light dark:bg-card-dark hover:bg-cardhover-light dark:hover:bg-cardhover-dark transition-colors"
    >
      {shown === PageTheme.dark ? <LuSun size={16} /> : <LuMoon size={16} />}
    </button>
  );
};

export default ThemeIconToggle;
