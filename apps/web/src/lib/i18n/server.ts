import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, pickLocale, type Locale } from "./locale";
import { translate, type TVars } from "./translate";

/** This request's UI language (cookie, else the browser's). */
export async function getLocale(): Promise<Locale> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLocale(c.get(LOCALE_COOKIE)?.value, h.get("accept-language"));
}

/** `t()` for server components. */
export async function getT() {
  const locale = await getLocale();
  return (text: string, vars?: TVars) => translate(locale, text, vars);
}
