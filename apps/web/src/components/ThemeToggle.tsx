"use client";
import { useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/state/hooks";
import { PageTheme, setPageTheme } from "@/state/pageThemeSlice";
import { Switch } from "@/components/ui/Switch";

const ThemeToggle = () => {
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
    dispatch(
      setPageTheme(
        theme === PageTheme.light ? PageTheme.dark : PageTheme.light,
      ),
    );
  };

  return (
    <div className="flex items-center justify-end gap-3">
      <div className="flex flex-col leading-tight text-2xs text-left text-dark dark:text-gray">
        <span>DARK</span>
        <span>MODE</span>
      </div>
      <div className="p-[6px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.15)] rounded-full bg-white dark:bg-[#27272a]">
        <Switch
          checked={theme === PageTheme.dark}
          aria-label="Toggle dark mode"
          className="cursor-pointer"
          onClick={handler}
        />
      </div>
    </div>
  );
};

export default ThemeToggle;
