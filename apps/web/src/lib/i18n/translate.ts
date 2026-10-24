import { DE } from "./de";
import type { Locale } from "./locale";

export type TVars = Record<string, string | number>;

/**
 * `text` (English) in `locale`, with `{name}` placeholders filled from
 * `vars`. Unknown texts come back in English.
 */
export function translate(locale: Locale, text: string, vars?: TVars): string {
  const out = locale === "de" ? (DE[text] ?? text) : text;
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
}

/** The English singular or plural key for `n` (then translated with `{n}`). */
export const pl = (n: number, one: string, other: string) =>
  n === 1 ? one : other;
