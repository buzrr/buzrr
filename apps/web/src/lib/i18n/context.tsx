"use client";

import { createContext, useContext, type ReactNode } from "react";
import { LOCALE_COOKIE, type Locale } from "./locale";
import { translate, type TVars } from "./translate";
export { pl } from "./translate";

const LocaleContext = createContext<Locale>("en");

// For helpers outside components (no hooks there). The page's language is
// fixed for its lifetime (changing it reloads), so a module value is enough
// in the browser; on the server each render sets it before rendering.
let current: Locale = "en";
const setCurrent = (l: Locale) => {
  current = l;
};

/** Set once in the root layout from the request (cookie / Accept-Language). */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  setCurrent(locale);
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);

/** `t("English text", { vars })` in the user's language. */
export function useT() {
  const locale = useContext(LocaleContext);
  return (text: string, vars?: TVars) => translate(locale, text, vars);
}

/** The page's language, for helpers outside components. */
export const currentLocale = () => current;

/** `t()` for helpers outside components. */
export const tx = (text: string, vars?: TVars) =>
  translate(current, text, vars);

/** Switches the UI language ("auto" = follow the browser) and reloads. */
export function setLocalePreference(choice: Locale | "auto") {
  document.cookie =
    choice === "auto"
      ? `${LOCALE_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${LOCALE_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}

/** The stored choice, or "auto" when following the browser. */
export function localePreference(): Locale | "auto" {
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=(en|de)`),
  );
  return (m?.[1] as Locale | undefined) ?? "auto";
}
