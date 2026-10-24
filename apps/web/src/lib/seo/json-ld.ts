import {
  LICENSE_URL,
  REPO_URL,
  SITE_DESCRIPTION,
  siteName,
  SITE_URL,
  SOCIAL_PROFILES,
  absoluteUrl,
} from "./site";

/**
 * Schema.org builders. Everything here must describe what is visible on the
 * page: no ratings, reviews or HowTo markup — Buzrr has no verified reviews.
 * FAQPage is used only where the same questions and answers are rendered on
 * the page (`FaqList`). Google limits FAQ rich results to authoritative
 * sites, so it is there for other search engines and answer engines, not for
 * a Google snippet.
 */

type JsonLdNode = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;

export function organizationSchema(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: siteName(),
    url: SITE_URL,
    logo: absoluteUrl("/icon.png"),
    sameAs: SOCIAL_PROFILES,
  };
}

export function websiteSchema(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: siteName(),
    url: SITE_URL,
    inLanguage: "en",
    publisher: { "@id": ORG_ID },
  };
}

/**
 * The product itself. `offers` states only the free plan (price 0): the Pro
 * price is regional and read live from the payment provider, so it is not
 * hardcoded into markup.
 */
export function softwareApplicationSchema(): JsonLdNode {
  return {
    "@type": "WebApplication",
    "@id": SOFTWARE_ID,
    name: siteName(),
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "EducationalApplication",
    applicationSubCategory: "Quiz",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires a modern web browser with JavaScript.",
    isAccessibleForFree: true,
    license: LICENSE_URL,
    offers: {
      "@type": "Offer",
      name: "Free plan",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Live hosted multiplayer quiz rooms joined with a 6-character code, link or QR code",
      "Players join as guests without creating an account",
      "Ranked 1v1 quiz battles with ELO matchmaking",
      "AI quiz generation from a topic description",
      "AI question generation from uploaded PDF, DOCX, TXT and Markdown documents",
      "Open source under AGPL-3.0 and self-hostable",
    ],
    publisher: { "@id": ORG_ID },
  };
}

export function sourceCodeSchema(): JsonLdNode {
  return {
    "@type": "SoftwareSourceCode",
    "@id": `${SITE_URL}/#source`,
    name: `${siteName()} source code`,
    codeRepository: REPO_URL,
    license: LICENSE_URL,
    programmingLanguage: ["TypeScript", "Python"],
    runtimePlatform: ["Node.js", "PostgreSQL", "Redis"],
    targetProduct: { "@id": SOFTWARE_ID },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbSchema(crumbs: Crumb[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function webPageSchema({
  path,
  title,
  description,
  type = "WebPage",
}: {
  path: string;
  title: string;
  description: string;
  type?: "WebPage" | "CollectionPage" | "AboutPage";
}): JsonLdNode {
  return {
    "@type": type,
    "@id": `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name: title,
    description,
    inLanguage: "en",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": SOFTWARE_ID },
  };
}

export interface Faq {
  question: string;
  answer: string;
}

export function faqPageSchema(path: string, faqs: Faq[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl(path)}#faq`,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

/** The site-wide nodes every marketing page carries. */
export function siteGraph(): JsonLdNode[] {
  return [organizationSchema(), websiteSchema(), softwareApplicationSchema()];
}

/** Serialize a graph for a `<script type="application/ld+json">`. */
export function serializeJsonLd(nodes: JsonLdNode[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": nodes,
  }).replace(/</g, "\\u003c");
}
