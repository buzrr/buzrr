"use client";

import { useEffect } from "react";
import { LuMoon, LuSun } from "react-icons/lu";
import { useAppSelector, useAppDispatch } from "@/state/hooks";
import { PageTheme, setPageTheme } from "@/state/pageThemeSlice";
import { withThemeTransition } from "@/utils/themeTransition";

/** Compact sun/moon theme switch for the landing navbar. */
const ThemeIconToggle = () => {
  const theme = useAppSelector((state) => state.pageTheme.theme);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (theme === PageTheme.dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const handler = () => {
    withThemeTransition();
    dispatch(
      setPageTheme(
        theme === PageTheme.light ? PageTheme.dark : PageTheme.light,
      ),
    );
  };

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={handler}
      className="flex items-center justify-center size-9 rounded-full text-dark dark:text-white bg-card-light dark:bg-card-dark hover:bg-cardhover-light dark:hover:bg-cardhover-dark transition-colors"
    >
      {theme === PageTheme.dark ? <LuSun size={16} /> : <LuMoon size={16} />}
    </button>
  );
};

export default ThemeIconToggle;
