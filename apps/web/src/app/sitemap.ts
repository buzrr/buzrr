import type { MetadataRoute } from "next";
import { LEGAL_PAGES } from "@/data/legal";
import { MARKETING_PAGES } from "@/data/marketing/pages";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Canonical, indexable pages only. App areas (admin, player, duel, join,
 * billing, auth), API routes and the noindexed "coming soon" /docs page are
 * deliberately absent.
 *
 * `lastModified` is set only where we know it: the marketing content date.
 */
const MARKETING_CONTENT_UPDATED = new Date("2026-10-01");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/pricing"), changeFrequency: "monthly", priority: 0.8 },
    ...MARKETING_PAGES.map((page) => ({
      url: absoluteUrl(page.path),
      lastModified: MARKETING_CONTENT_UPDATED,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: absoluteUrl("/support"), changeFrequency: "yearly", priority: 0.3 },
    ...LEGAL_PAGES.map((page) => ({
      url: absoluteUrl(page.path),
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
