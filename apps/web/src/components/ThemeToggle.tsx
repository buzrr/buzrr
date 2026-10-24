"use client";
import { useAppDispatch } from "@/state/hooks";
import { PageTheme, setPageTheme } from "@/state/pageThemeSlice";
import { Switch } from "@/components/ui/Switch";
import { withThemeTransition } from "@/utils/themeTransition";
import { useRenderedTheme } from "@/hooks/useRenderedTheme";

const ThemeToggle = () => {
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
    <div className="flex items-center justify-end gap-3">
      <div className="flex flex-col leading-tight text-2xs text-left text-dark dark:text-gray">
        <span>DARK</span>
        <span>MODE</span>
      </div>
      <div className="p-[6px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.15)] rounded-full bg-white dark:bg-card-dark">
        <Switch
          checked={shown === PageTheme.dark}
          aria-label="Toggle dark mode"
          className="cursor-pointer"
          onClick={handler}
        />
      </div>
    </div>
  );
};

export default ThemeToggle;
