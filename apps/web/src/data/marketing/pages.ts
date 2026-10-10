import {
  COMPARE_SLUGS,
  COMPETITORS,
  COMPETITOR_SLUGS,
  alternativePath,
  comparePath,
} from "./competitors";
import { USE_CASES, USE_CASE_SLUGS } from "./use-cases";

/**
 * Registry of the indexable marketing pages under `app/(marketing)`. The
 * sitemap and the social-card route (`app/og/[image]`) both read it, so a page
 * added here gets a sitemap entry and an OG image, and a page removed here
 * loses both.
 */
export interface MarketingPage {
  path: string;
  /** Key served at `/og/{ogKey}.png`. */
  ogKey: string;
  ogEyebrow: string;
  ogTitle: string;
  ogAlt: string;
}

export const OPEN_SOURCE_PAGE: MarketingPage = {
  path: "/open-source-quiz-platform",
  ogKey: "open-source-quiz-platform",
  ogEyebrow: "Open source · AGPL-3.0",
  ogTitle: "An open-source quiz platform you can read, run and change",
  ogAlt: "Buzrr: an open-source quiz platform",
};

export const SELF_HOST_PAGE: MarketingPage = {
  path: "/self-hosted-quiz",
  ogKey: "self-hosted-quiz",
  ogEyebrow: "Self-hosting",
  ogTitle: "Run your own live quiz server with Buzrr",
  ogAlt: "Self-hosting Buzrr, the open-source quiz platform",
};

export const ALTERNATIVES_HUB: MarketingPage = {
  path: "/alternatives",
  ogKey: "alternatives",
  ogEyebrow: "Alternatives",
  ogTitle: "Alternatives to Kahoot!, Slido, Mentimeter and Quizizz",
  ogAlt: "Buzrr compared with Kahoot!, Slido, Mentimeter and Quizizz",
};

export const USE_CASES_HUB: MarketingPage = {
  path: "/use-cases",
  ogKey: "use-cases",
  ogEyebrow: "Use cases",
  ogTitle: "Live quizzes for classrooms, events, teams and trivia nights",
  ogAlt: "What people use Buzrr for",
};

export function alternativePage(slug: keyof typeof COMPETITORS): MarketingPage {
  const c = COMPETITORS[slug];
  return {
    path: alternativePath(slug),
    ogKey: `alternatives-${slug}`,
    ogEyebrow: `${c.displayName} alternative`,
    ogTitle: c.alternative.h1,
    ogAlt: `Buzrr as a ${c.displayName} alternative`,
  };
}

export function comparePage(slug: keyof typeof COMPETITORS): MarketingPage {
  const c = COMPETITORS[slug];
  return {
    path: comparePath(slug),
    ogKey: `compare-buzrr-vs-${slug}`,
    ogEyebrow: "Comparison",
    ogTitle: `Buzrr vs ${c.displayName}, feature by feature`,
    ogAlt: `Buzrr vs ${c.displayName} comparison`,
  };
}

export function pageForUseCase(slug: keyof typeof USE_CASES): MarketingPage {
  const u = USE_CASES[slug];
  return {
    path: `/use-cases/${slug}`,
    ogKey: `use-cases-${slug}`,
    ogEyebrow: u.name,
    ogTitle: u.h1,
    ogAlt: `Buzrr for ${u.name.toLowerCase()}`,
  };
}

export const MARKETING_PAGES: MarketingPage[] = [
  ALTERNATIVES_HUB,
  ...COMPETITOR_SLUGS.map(alternativePage),
  ...COMPARE_SLUGS.map(comparePage),
  USE_CASES_HUB,
  ...USE_CASE_SLUGS.map(pageForUseCase),
  OPEN_SOURCE_PAGE,
  SELF_HOST_PAGE,
];

export function ogImageFor(page: MarketingPage) {
  return { key: page.ogKey, alt: page.ogAlt };
}
