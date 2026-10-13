import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CtaPanel,
  FaqList,
  JsonLd,
  LinkCards,
  PageContainer,
  PageHero,
  Prose,
  Section,
  breadcrumbSchema,
} from "@/components/Marketing/primitives";
import {
  ComparisonTable,
  InlineLink,
  OPEN_SOURCE_CARD,
  QuizizzRebrand,
  SELF_HOST_CARD,
  SourceList,
  compareCards,
  cardsForUseCases,
} from "@/components/Marketing/product";
import {
  COMPARE_ROWS,
  COMPARE_SLUGS,
  COMPETITORS,
  alternativePath,
  compareTitle,
  type CompetitorSlug,
} from "@/data/marketing/competitors";
import { comparePage, ogImageFor } from "@/data/marketing/pages";
import { PLAN_FACTS } from "@/data/marketing/product";
import { faqPageSchema, siteGraph, webPageSchema } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;

const PREFIX = "buzrr-vs-";

export function generateStaticParams() {
  return COMPARE_SLUGS.map((slug) => ({ slug: `${PREFIX}${slug}` }));
}

type Params = Promise<{ slug: string }>;

function getComparison(param: string) {
  if (!param.startsWith(PREFIX)) return null;
  const slug = param.slice(PREFIX.length);
  if (!(COMPARE_SLUGS as string[]).includes(slug)) return null;
  const competitor = COMPETITORS[slug as CompetitorSlug];
  return competitor.compare
    ? { competitor, compare: competitor.compare }
    : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const found = getComparison((await params).slug);
  if (!found) return {};
  const page = comparePage(found.competitor.slug);
  return buildPageMetadata({
    title: compareTitle(found.competitor),
    absoluteTitle: true,
    description: found.compare.description,
    path: page.path,
    ogImage: ogImageFor(page),
  });
}

export default async function ComparePage({ params }: { params: Params }) {
  const found = getComparison((await params).slug);
  if (!found) notFound();
  const { competitor: c, compare } = found;
  const page = comparePage(c.slug);
  const title = compareTitle(c);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Alternatives", path: "/alternatives" },
    { name: `Buzrr vs ${c.displayName}`, path: page.path },
  ];

  return (
    <PageContainer>
      <JsonLd
        nodes={[
          ...siteGraph(),
          webPageSchema({
            path: page.path,
            title,
            description: compare.description,
          }),
          breadcrumbSchema(crumbs),
          faqPageSchema(page.path, compare.faq),
        ]}
      />
      <PageHero
        crumbs={crumbs}
        eyebrow="Comparison"
        title={`Buzrr vs ${c.displayName}`}
        lead={compare.lead}
        primary={{ label: "Try Buzrr free", href: "/admin" }}
        secondary={{
          label: `Open-source ${c.searchName} alternative`,
          href: alternativePath(c.slug),
        }}
      />

      {c.slug === "quizizz" && <QuizizzRebrand />}

      <Section title="Feature and pricing comparison">
        <ComparisonTable slug={c.slug} rows={COMPARE_ROWS} />
      </Section>

      <Section title="Pricing">
        <Prose
          paragraphs={[
            `Buzrr has a free plan: rooms of up to ${PLAN_FACTS.freePlayers} players, up to ${PLAN_FACTS.freeQuizzes} quizzes and ${PLAN_FACTS.freeAi} AI generations. Buzrr Pro raises that to ${PLAN_FACTS.proPlayers}-player rooms, unlimited quizzes and ${PLAN_FACTS.proAiPerWeek} AI generations a week. Self-hosted instances run without billing and get Pro limits.`,
            `We don't quote ${c.displayName}'s prices: they vary by plan, region and account type, and change over time. Check the official page linked in the table.`,
          ]}
        />
        <p className="mt-4 text-dark/80 dark:text-off-white">
          Current Buzrr prices are on the{" "}
          <InlineLink href="/pricing">Buzrr pricing page</InlineLink>.
        </p>
      </Section>

      <Section title={`What ${c.displayName} and Buzrr are`}>
        <Prose paragraphs={[c.summary.text, ...compare.overview]} />
        <p className="mt-6 max-w-3xl text-dark/80 dark:text-off-white">
          Deciding whether to switch? The{" "}
          <InlineLink href={alternativePath(c.slug)}>
            open-source {c.searchName} alternative guide
          </InlineLink>{" "}
          covers why people move, who Buzrr suits, and when {c.displayName} is
          the better fit.
        </p>
      </Section>

      <Section title={`Buzrr vs ${c.searchName} FAQ`}>
        <FaqList faqs={compare.faq} />
      </Section>

      <Section title="Sources">
        <SourceList slug={c.slug} />
        <p className="mt-3 text-sm text-dark/60 dark:text-gray">
          Buzrr&rsquo;s column is based on the Buzrr source code on GitHub.
        </p>
      </Section>

      <Section title="Where each fits">
        <LinkCards items={cardsForUseCases(compare.useCases)} />
      </Section>

      <Section title="More comparisons">
        <LinkCards
          items={[
            ...compareCards(COMPARE_SLUGS.filter((s) => s !== c.slug)),
            OPEN_SOURCE_CARD,
            SELF_HOST_CARD,
          ]}
        />
      </Section>

      <CtaPanel
        title="See for yourself"
        text="Buzrr is free to start. Build a quiz, host a room and have a few friends join from their phones."
        primary={{ label: "Create a free quiz", href: "/admin" }}
        secondary={{
          label: "Read the code",
          href: "https://github.com/buzrr/buzrr",
        }}
      />
      <p className="mt-6 text-center text-sm text-dark/60 dark:text-gray">
        {c.displayName} is a trademark of its owner. Buzrr is not affiliated
        with {c.displayName}.
      </p>
    </PageContainer>
  );
}
