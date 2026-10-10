import Link from "next/link";
import {
  Answer,
  BulletList,
  CtaPanel,
  JsonLd,
  LinkCards,
  PageContainer,
  PageHero,
  Section,
  breadcrumbSchema,
} from "@/components/Marketing/primitives";
import {
  OPEN_SOURCE_CARD,
  SELF_HOST_CARD,
  WhatIsBuzrr,
  alternativeCards,
  compareCards,
  cardsForUseCases,
} from "@/components/Marketing/product";
import {
  COMPARE_SLUGS,
  COMPETITORS,
  COMPETITOR_SLUGS,
  FACTS_CHECKED,
  alternativePath,
} from "@/data/marketing/competitors";
import { ALTERNATIVES_HUB, ogImageFor } from "@/data/marketing/pages";
import { webPageSchema, siteGraph } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Alternatives to Kahoot, Slido, Mentimeter and Quizizz";
const DESCRIPTION =
  "How Buzrr, an open-source live quiz platform, compares with Kahoot!, Slido, Mentimeter, Quizizz and QuizUp — and when another tool fits better.";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: ALTERNATIVES_HUB.path,
  ogImage: ogImageFor(ALTERNATIVES_HUB),
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Alternatives", path: ALTERNATIVES_HUB.path },
];

/** Plain-language routing: which tool fits which need. */
const CHOOSING = [
  "You want a live, competitive quiz game on players' own devices — Buzrr, Kahoot! and Quizizz/Wayground all run one; Buzrr is the open-source one.",
  "You want to self-host or audit the code — of the tools here, only Buzrr is open source.",
  "You want ranked 1v1 quiz battles like QuizUp had — Buzrr's duel mode.",
  "You need audience Q&A, polls or word clouds — Slido or Mentimeter; Buzrr doesn't do these.",
  "You want quiz questions inside a presentation — Mentimeter's quiz slides, or Slido's slide integrations.",
  "You assign self-paced homework, need LMS integration or accommodations — Wayground (formerly Quizizz) or Kahoot!'s self-paced challenges; Buzrr is live only.",
];

export default function AlternativesHubPage() {
  return (
    <PageContainer>
      <JsonLd
        nodes={[
          ...siteGraph(),
          webPageSchema({
            path: ALTERNATIVES_HUB.path,
            title: TITLE,
            description: DESCRIPTION,
            type: "CollectionPage",
          }),
          breadcrumbSchema(crumbs),
        ]}
      />
      <PageHero
        crumbs={crumbs}
        eyebrow="Alternatives"
        title={TITLE}
        lead="Buzrr is one of several ways to run a live quiz. This page lays out what each popular tool is built for, where Buzrr overlaps with it, and where it doesn't — so you can pick the right one, even if that isn't us."
        primary={{ label: "Try Buzrr free", href: "/admin" }}
        secondary={{
          label: "See it on GitHub",
          href: "https://github.com/buzrr/buzrr",
        }}
      />

      <WhatIsBuzrr />

      <Section
        title="The tools at a glance"
        intro={`One-line summaries from each product's own public pages (checked ${FACTS_CHECKED}). Follow a link for the full comparison and sources.`}
      >
        <div className="overflow-x-auto rounded-2xl border border-card-light dark:border-off-dark bg-white dark:bg-dark">
          <table className="w-full min-w-160 text-sm text-left text-dark dark:text-off-white">
            <caption className="sr-only">
              Overview of Buzrr and popular live quiz tools
            </caption>
            <thead>
              <tr className="border-b border-card-light dark:border-off-dark text-dark dark:text-white">
                <th scope="col" className="p-4 font-bold w-40">
                  Tool
                </th>
                <th scope="col" className="p-4 font-bold">
                  What it is
                </th>
                <th scope="col" className="p-4 font-bold w-32">
                  Open source
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-card-light dark:border-off-dark align-top">
                <th
                  scope="row"
                  className="p-4 font-semibold text-lprimary dark:text-dprimary"
                >
                  Buzrr
                </th>
                <td className="p-4">
                  Live hosted quiz rooms, ranked 1v1 quiz battles and AI
                  question generation, in the browser.
                </td>
                <td className="p-4">Yes (AGPL-3.0)</td>
              </tr>
              {COMPETITOR_SLUGS.map((slug) => {
                const c = COMPETITORS[slug];
                const source = c.sources[c.summary.source ?? 0];
                return (
                  <tr
                    key={slug}
                    className="border-b last:border-b-0 border-card-light dark:border-off-dark align-top"
                  >
                    <th scope="row" className="p-4 font-semibold">
                      <Link
                        href={alternativePath(slug)}
                        className="underline underline-offset-4 hover:text-lprimary dark:hover:text-dprimary"
                      >
                        {c.displayName}
                      </Link>
                    </th>
                    <td className="p-4">
                      {c.summary.text}{" "}
                      <a
                        href={source.href}
                        target="_blank"
                        rel="noreferrer nofollow"
                        className="text-xs underline underline-offset-2 text-dark/60 dark:text-gray"
                      >
                        source
                      </a>
                    </td>
                    <td className="p-4">
                      {slug === "quizup" ? "No (discontinued)" : "No"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Which one fits what you're doing">
        <BulletList items={CHOOSING} />
      </Section>

      <Section
        title="Buzrr as an alternative to…"
        intro="Each page covers why people switch, what's genuinely different, and when you're better off staying where you are."
      >
        <LinkCards items={alternativeCards(COMPETITOR_SLUGS)} />
      </Section>

      <Section
        title="Side-by-side comparisons"
        intro="Feature tables with a source for every competitor claim, and unknowns marked as unknown."
      >
        <LinkCards items={compareCards(COMPARE_SLUGS)} />
      </Section>

      <Section title="Open source and self-hosting">
        <LinkCards items={[OPEN_SOURCE_CARD, SELF_HOST_CARD]} />
      </Section>

      <Section title="What people run on Buzrr">
        <LinkCards
          items={cardsForUseCases([
            "classroom-quizzes",
            "college-events",
            "corporate-training",
            "live-audience-quizzes",
            "team-building",
            "pub-trivia",
          ])}
        />
      </Section>

      <Section title="Common questions">
        <div className="grid gap-4">
          <Answer question="Is Buzrr free?">
            <p>
              Yes, there is a free plan with no time limit. Buzrr Pro raises
              room size, quiz and AI limits — see{" "}
              <Link href="/pricing" className="underline underline-offset-4">
                Buzrr pricing
              </Link>
              . Self-hosting the open-source code is free.
            </p>
          </Answer>
          <Answer question="Is Buzrr open source?">
            <p>
              Yes. The whole application is on GitHub under the AGPL-3.0
              license, and you can run your own instance.
            </p>
          </Answer>
        </div>
      </Section>

      <CtaPanel
        title="Host your first Buzrr quiz"
        text="Sign in with Google, build or generate a quiz, and put the join code on the screen."
        primary={{ label: "Create a quiz", href: "/admin" }}
        secondary={{ label: "Play a 1v1 battle", href: "/duel" }}
      />
    </PageContainer>
  );
}
