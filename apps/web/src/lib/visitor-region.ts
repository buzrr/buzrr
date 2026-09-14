import "server-only";
import { headers } from "next/headers";
import { priceRegionFromCountry } from "@/lib/pricing";
import type { PriceRegion } from "@/lib/pricing";

/**
 * Visitor country from the hosting edge (Vercel, then Cloudflare). `null` when
 * neither header is present — e.g. local dev — so the browser decides instead
 * (`usePriceRegion`). Display-only; never used to decide what anyone is charged.
 */
export async function getVisitorPriceRegion(): Promise<PriceRegion | null> {
  const h = await headers();
  return priceRegionFromCountry(
    h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry"),
  );
}
