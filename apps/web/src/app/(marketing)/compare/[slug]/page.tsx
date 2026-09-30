import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BulletList,
  CtaPanel,
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
  SELF_HOST_CARD,
  SourceList,
  compareCards,
  cardsForUseCases,
} from "@/components/Marketing/product";
import {
  COMPARE_SLUGS,
  COMPETITORS,
  alternativePath,
  type CompetitorSlug,
} from "@/data/marketing/competitors";
import { comparePage, ogImageFor } from "@/data/marketing/pages";
import { PLAN_FACTS } from "@/data/marketing/product";
import { siteGraph, webPageSchema } from "@/lib/seo/json-ld";
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
    title: found.compare.title,
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
            title: compare.title,
            description: compare.description,
          }),
          breadcrumbSchema(crumbs),
        ]}
      />
      <PageHero
        crumbs={crumbs}
        eyebrow="Comparison"
        title={compare.h1}
        lead={compare.intro[0]}
        primary={{ label: "Try Buzrr free", href: "/admin" }}
        secondary={{
          label: `Why switch from ${c.displayName}`,
          href: alternativePath(c.slug),
        }}
      />

      <Prose paragraphs={compare.intro.slice(1)} />

      <Section title="Feature comparison">
        <ComparisonTable slug={c.slug} rows={compare.rows} />
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

      <Section title="Which should you pick?">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="font-bold text-dark dark:text-white mb-3">
              Pick Buzrr if…
            </h3>
            <BulletList items={compare.chooseBuzrr} tone="positive" />
          </div>
          <div>
            <h3 className="font-bold text-dark dark:text-white mb-3">
              Pick {c.displayName} if…
            </h3>
            <BulletList items={compare.chooseCompetitor} />
          </div>
        </div>
        <p className="mt-6 text-dark/80 dark:text-off-white">
          Reasons people move, and what Buzrr does differently, are on the{" "}
          <InlineLink href={alternativePath(c.slug)}>
            {c.displayName} alternative page
          </InlineLink>
          .
        </p>
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
