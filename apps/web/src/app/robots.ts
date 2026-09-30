import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Blocks only what crawlers can't use: API routes and the signed-in areas
 * (which redirect to login anyway). Player, duel, join and auth pages stay
 * crawlable on purpose — they carry `noindex`, and a crawler has to fetch a
 * page to see that. Join links get shared publicly, so disallowing them here
 * could leave bare URLs in the index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/billing"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
