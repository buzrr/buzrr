"use client";
import { useEffect } from "react";
import { RootState } from "@/state/store";
import { useSelector, useDispatch } from "react-redux";
import { pageTheme, setpageTheme } from "@/state/pageThemeSlice";

const ThemeToggle = () => {
  const theme = useSelector((state: RootState) => state.pageTheme.theme);
  const dispatch = useDispatch();

  useEffect(() => {
    if (theme === pageTheme.dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const handler = () => {
    dispatch(
      setpageTheme(
        theme === pageTheme.light ? pageTheme.dark : pageTheme.light,
      ),
    );
  };

  return (
    <div className="justify-self-end p-[6px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.15)] rounded-full bg-white dark:bg-[#27272a]">
      <div
        className="w-8 h-5 rounded-full bg-[#abacaf] dark:bg-dprimary flex items-center p-1 cursor-pointer"
        onClick={handler}
      >
        <div className="w-3 h-3 bg-white dark:ml-[50%] rounded-full transition-all duration-200 ease-in-out"></div>
      </div>
    </div>
  );
};

export default ThemeToggle;
