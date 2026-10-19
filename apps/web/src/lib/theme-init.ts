import { PageTheme } from "@/state/pageThemeSlice";

/**
 * Runs in <head> before the first paint: the stored choice (redux-persist's
 * `persist:root`), else the device's, so a dark page never flashes light.
 * Before store version 3, "light" was only the default, not a choice.
 */
export const THEME_INIT_SCRIPT = `try{var r=JSON.parse(localStorage.getItem("persist:root")||"{}"),t=JSON.parse(r.pageTheme||"{}").theme,v=JSON.parse(r._persist||"{}").version;if(t===${PageTheme.light}&&!(v>=3))t=${PageTheme.system};document.documentElement.classList.toggle("dark",t===${PageTheme.dark}||(t!==${PageTheme.light}&&matchMedia("(prefers-color-scheme: dark)").matches))}catch(e){}`;
