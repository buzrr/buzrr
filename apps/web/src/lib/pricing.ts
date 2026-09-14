/**
 * Pricing display helpers. The numbers shown come from the API
 * (`GET /billing/pricing`, read live from the Dodo product); `FALLBACK_PRICING`
 * is only used while that loads or if it fails. What is actually charged is
 * decided by Dodo from the customer's billing country.
 */
export type PriceRegion = "IN" | "GLOBAL";

export const FALLBACK_PRICING: Record<
  PriceRegion,
  { currency: string; amount: number }
> = {
  IN: { currency: "INR", amount: 39900 },
  GLOBAL: { currency: "USD", amount: 499 },
};

export function priceRegionFromCountry(
  country: string | null | undefined,
): PriceRegion | null {
  const code = country?.trim().toUpperCase();
  // "XX"/"T1" are the edges' "unknown"/Tor markers — treat as no signal.
  if (!code || code === "XX" || code === "T1") return null;
  return code === "IN" ? "IN" : "GLOBAL";
}

/**
 * Browser-side fallback when the hosting edge gave no country (local dev,
 * non-Vercel hosts): an Indian timezone or an `-IN` locale means India.
 */
export function detectBrowserRegion(): PriceRegion {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone === "Asia/Kolkata" || zone === "Asia/Calcutta") return "IN";
  } catch {
    // Fall through to the language check.
  }
  const languages =
    typeof navigator === "undefined"
      ? []
      : (navigator.languages ?? [navigator.language]);
  return languages.some((lang) => /-IN$/i.test(lang)) ? "IN" : "GLOBAL";
}

/** Minor units → "₹399" / "$4.99". Whole amounts drop the decimals. */
export function formatMoney(minorUnits: number, currency: string): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  try {
    const digits =
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2;
    const value = minorUnits / 10 ** digits;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${(minorUnits / 100).toFixed(2)} ${currency}`;
  }
}

/** Plan numbers for marketing copy — mirrors the server's `PLAN_LIMITS`. */
export const PLAN_COPY = {
  free: { maxPlayers: 50, maxQuizzes: 10, aiTokens: 3 },
  pro: { maxPlayers: 250, aiTokensPerWeek: 10 },
} as const;
