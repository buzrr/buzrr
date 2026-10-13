import type { MetadataRoute } from "next";
import { LEGAL_PAGES } from "@/data/legal";
import { MARKETING_PAGES } from "@/data/marketing/pages";
import { lastCommitDate } from "@/lib/seo/last-modified";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Canonical, indexable pages only. App areas (admin, player, duel, join,
 * billing, auth), API routes and the noindexed "coming soon" /docs page are
 * deliberately absent — list /docs here once it has real, indexable content.
 *
 * `lastModified` is the last git commit touching a page's source files
 * (`MarketingPage.sourceFiles`), and is left out wherever git can't say
 * truthfully (see lib/seo/last-modified.ts).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/pricing"), changeFrequency: "monthly", priority: 0.8 },
    ...MARKETING_PAGES.map((page) => ({
      url: absoluteUrl(page.path),
      lastModified: lastCommitDate(page.sourceFiles),
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
