"use client";

import { useEffect, useState } from "react";
import { detectBrowserRegion } from "@/lib/pricing";
import type { PriceRegion } from "@/lib/pricing";

/**
 * India sees INR, everyone else USD. The edge's country header wins when there
 * is one; otherwise the browser's timezone/locale decides after mount, and
 * `resolved` stays false until then so the wrong currency never flashes.
 */
export function usePriceRegion(serverRegion: PriceRegion | null) {
  const [region, setRegion] = useState<PriceRegion | null>(serverRegion);

  useEffect(() => {
    if (serverRegion === null) setRegion(detectBrowserRegion());
  }, [serverRegion]);

  return { region: region ?? "GLOBAL", resolved: region !== null };
}
