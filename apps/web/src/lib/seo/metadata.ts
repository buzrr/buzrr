import type { Metadata } from "next";
import { SITE_NAME, absoluteUrl } from "./site";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * `app/opengraph-image.png` (a real quiz-editor screenshot). A page that sets
 * `openGraph` without images would otherwise lose the inherited file image.
 */
const DEFAULT_OG_IMAGE = {
  url: absoluteUrl("/opengraph-image.png"),
  width: 935,
  height: 693,
  alt: "The Buzrr quiz editor",
};

interface PageMetadataInput {
  /** Page title. Gets the root `%s | Buzrr` template unless `absoluteTitle`. */
  title: string;
  description: string;
  /** Path of the page, e.g. `/alternatives/kahoot` — used for the canonical. */
  path: string;
  /** Use `title` verbatim instead of applying the `| Buzrr` template. */
  absoluteTitle?: boolean;
  /**
   * Social card image: a key served by `app/og/[image]/route.tsx`, or an
   * explicit URL. Omit to use the root `opengraph-image.png` screenshot.
   */
  ogImage?: { key: string; alt: string } | { url: string; alt: string };
  ogType?: "website" | "article";
  /** Keep the page out of search results (still followed). */
  noindex?: boolean;
}

/**
 * Metadata for one public page. Next merges `openGraph`/`twitter` shallowly —
 * a child that sets `openGraph` replaces the parent's whole object — so this
 * always emits complete OG and Twitter blocks alongside a self-referencing
 * canonical.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  ogImage,
  ogType = "website",
  noindex = false,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const socialTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const images = [
    ogImage
      ? {
          url:
            "key" in ogImage
              ? absoluteUrl(`/og/${ogImage.key}.png`)
              : ogImage.url,
          ...OG_IMAGE_SIZE,
          alt: ogImage.alt,
        }
      : DEFAULT_OG_IMAGE,
  ];

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: ogType,
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      title: socialTitle,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images,
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** For app areas (dashboards, game screens, join links): never indexed. */
export const NOINDEX_METADATA: Metadata = {
  robots: { index: false, follow: false },
};
