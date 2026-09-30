import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Answer,
  BulletList,
  CtaPanel,
  JsonLd,
  LinkCards,
  PageContainer,
  PageHero,
  PointGrid,
  Section,
  Steps,
  breadcrumbSchema,
} from "@/components/Marketing/primitives";
import {
  ComparisonTable,
  FeatureGrid,
  InlineLink,
  OPEN_SOURCE_CARD,
  ProductShots,
  SELF_HOST_CARD,
  SourceList,
  WhatIsBuzrr,
  alternativeCards,
  compareCards,
  cardsForUseCases,
} from "@/components/Marketing/product";
import {
  COMPETITORS,
  COMPETITOR_SLUGS,
  FACTS_CHECKED,
  QUIZUP_ROWS,
  comparePath,
  type CompetitorSlug,
} from "@/data/marketing/competitors";
import { alternativePage, ogImageFor } from "@/data/marketing/pages";
import { HOST_STEPS } from "@/data/marketing/product";
import { siteGraph, webPageSchema } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPETITOR_SLUGS.map((competitor) => ({ competitor }));
}

type Params = Promise<{ competitor: string }>;

function getCompetitor(slug: string) {
  return (COMPETITOR_SLUGS as string[]).includes(slug)
    ? COMPETITORS[slug as CompetitorSlug]
    : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const c = getCompetitor((await params).competitor);
  if (!c) return {};
  const page = alternativePage(c.slug);
  return buildPageMetadata({
    title: c.alternative.title,
    description: c.alternative.description,
    path: page.path,
    ogImage: ogImageFor(page),
  });
}

const DUEL_STEPS = [
  {
    title: "Sign in",
    text: "Duels need a Buzrr account so your rating has somewhere to live. Sign in with Google.",
  },
  {
    title: "Queue",
    text: "Open 1v1 and start searching. The matchmaker looks for someone near your ELO rating and widens the search the longer you wait.",
  },
  {
    title: "Play seven questions",
    text: "Both players get the same seven timed multiple-choice questions. Faster correct answers earn more points.",
  },
  {
    title: "Win, lose, adjust",
    text: "The higher total wins and both ratings move. Your match history is on your profile.",
  },
];

export default async function AlternativePage({ params }: { params: Params }) {
  const c = getCompetitor((await params).competitor);
  if (!c) notFound();
  const page = alternativePage(c.slug);
  const alt = c.alternative;
  const isQuizUp = c.slug === "quizup";

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Alternatives", path: "/alternatives" },
    { name: `${c.displayName} alternative`, path: page.path },
  ];

  return (
    <PageContainer>
      <JsonLd
        nodes={[
          ...siteGraph(),
          webPageSchema({
            path: page.path,
            title: alt.title,
            description: alt.description,
          }),
          breadcrumbSchema(crumbs),
        ]}
      />
      <PageHero
        crumbs={crumbs}
        eyebrow={`${c.displayName} alternative`}
        title={alt.h1}
        lead={alt.lead}
        primary={
          isQuizUp
            ? { label: "Start a 1v1 battle", href: "/duel" }
            : { label: "Create a free quiz", href: "/admin" }
        }
        secondary={
          c.compare
            ? {
                label: `Buzrr vs ${c.displayName} table`,
                href: comparePath(c.slug),
              }
            : { label: "Host a quiz room instead", href: "/admin" }
        }
      />

      <WhatIsBuzrr />

      <Section title={`About ${c.displayName}`}>
        <p className="max-w-3xl text-dark/80 dark:text-off-white leading-relaxed">
          {c.summary.text}
        </p>
        <div className="mt-4">
          <SourceList slug={c.slug} />
        </div>
      </Section>

      <Section title={alt.whyLook.heading}>
        <PointGrid points={alt.whyLook.points} />
      </Section>

      {isQuizUp ? (
        <Section
          title="QuizUp vs Buzrr 1v1 battles"
          intro="QuizUp details are from its Wikipedia article; Buzrr details are from our code."
        >
          <div className="overflow-x-auto rounded-2xl border border-card-light dark:border-off-dark bg-white dark:bg-dark">
            <table className="w-full min-w-[560px] text-sm text-left text-dark dark:text-off-white">
              <caption className="sr-only">
                QuizUp compared with Buzrr duels
              </caption>
              <thead>
                <tr className="border-b border-card-light dark:border-off-dark text-dark dark:text-white">
                  <th scope="col" className="p-4 font-bold w-1/5">
                    &nbsp;
                  </th>
                  <th scope="col" className="p-4 font-bold">
                    QuizUp (2013–2021)
                  </th>
                  <th
                    scope="col"
                    className="p-4 font-bold text-lprimary dark:text-dprimary"
                  >
                    Buzrr duels
                  </th>
                </tr>
              </thead>
              <tbody>
                {QUIZUP_ROWS.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b last:border-b-0 border-card-light dark:border-off-dark align-top"
                  >
                    <th
                      scope="row"
                      className="p-4 font-semibold text-dark dark:text-white"
                    >
                      {row.label}
                    </th>
                    <td className="p-4">{row.quizup}</td>
                    <td className="p-4">{row.buzrr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : (
        <Section
          title={`Buzrr vs ${c.displayName} at a glance`}
          intro={`The rows that matter most when switching from ${c.displayName}.`}
        >
          <ComparisonTable slug={c.slug} rows={alt.keyRows} />
          <p className="mt-4 text-dark/80 dark:text-off-white">
            The{" "}
            <InlineLink href={comparePath(c.slug)}>
              full Buzrr vs {c.displayName} comparison
            </InlineLink>{" "}
            covers AI generation, scoring, question types and pricing too.
          </p>
        </Section>
      )}

      <Section title={alt.differences.heading}>
        <PointGrid points={alt.differences.points} />
      </Section>

      <Section title="Buzrr features you'd use">
        <FeatureGrid ids={alt.features} />
      </Section>

      <Section title={isQuizUp ? "How a Buzrr duel works" : "How Buzrr works"}>
        <Steps steps={isQuizUp ? DUEL_STEPS : HOST_STEPS} />
      </Section>

      <Section title="Who Buzrr suits — and who it doesn't">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="font-bold text-dark dark:text-white mb-3">
              Buzrr is a good fit if…
            </h3>
            <BulletList items={alt.goodFit} tone="positive" />
          </div>
          <div>
            <h3 className="font-bold text-dark dark:text-white mb-3">
              {isQuizUp
                ? "What Buzrr doesn't bring back"
                : `Stay with ${c.displayName} if…`}
            </h3>
            <BulletList items={alt.stayWith} tone="caution" />
          </div>
        </div>
      </Section>

      <Section title="What it looks like">
        <ProductShots />
      </Section>

      <Section title="The short answer">
        <Answer question={alt.answer.question}>
          <p>{alt.answer.text}</p>
          <p className="mt-3 text-xs text-dark/60 dark:text-gray">
            {c.displayName} facts checked {FACTS_CHECKED}.
          </p>
        </Answer>
      </Section>

      <Section title="What people use Buzrr for">
        <LinkCards items={cardsForUseCases(alt.useCases)} />
      </Section>

      <Section title="Other alternatives and comparisons">
        <LinkCards
          items={[
            ...alternativeCards(alt.related),
            ...compareCards(c.compare ? [c.slug] : []),
          ]}
        />
      </Section>

      <Section title="Open source and self-hosting">
        <LinkCards items={[OPEN_SOURCE_CARD, SELF_HOST_CARD]} />
      </Section>

      <CtaPanel
        title={
          isQuizUp ? "Play your first 1v1 battle" : "Run your first Buzrr quiz"
        }
        text={
          isQuizUp
            ? "Sign in with Google and hit Start 1v1. Your rating starts at 1200."
            : "Sign in with Google, build or generate a quiz, and put the code on the screen. Players don't need an account."
        }
        primary={
          isQuizUp
            ? { label: "Start a 1v1 battle", href: "/duel" }
            : { label: "Create a free quiz", href: "/admin" }
        }
        secondary={{ label: "All alternatives", href: "/alternatives" }}
      />
      <p className="mt-6 text-center text-sm text-dark/60 dark:text-gray">
        {c.displayName} is a trademark of its owner. Buzrr is not affiliated
        with {c.displayName}. See also{" "}
        <Link href="/pricing" className="underline underline-offset-4">
          Buzrr pricing
        </Link>
        .
      </p>
    </PageContainer>
  );
}
