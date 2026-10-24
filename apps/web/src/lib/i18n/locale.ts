/**
 * UI languages. English is the source: every text is written in English in
 * the code and looked up in the German dictionary (`de.ts`); a text without
 * a translation simply stays English.
 */
export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];

/** The user's choice ("en" / "de"); no cookie = follow the browser. */
export const LOCALE_COOKIE = "buzrr-lang";

export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** Cookie first, then the browser's preferred languages, else English. */
export function pickLocale(
  cookie: string | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookie)) return cookie;
  const wanted = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return {
        lang: (tag ?? "").slice(0, 2).toLowerCase(),
        q: q ? Number(q) : 1,
      };
    })
    .filter((x) => x.lang)
    .sort((a, b) => b.q - a.q);
  for (const { lang } of wanted) if (isLocale(lang)) return lang;
  return "en";
}

/** English name of the language, for the AI prompt. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  de: "German",
};
