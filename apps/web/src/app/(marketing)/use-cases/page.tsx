import {
  CtaPanel,
  JsonLd,
  LinkCards,
  PageContainer,
  PageHero,
  Section,
  breadcrumbSchema,
} from "@/components/Marketing/primitives";
import {
  FeatureGrid,
  OPEN_SOURCE_CARD,
  SELF_HOST_CARD,
  WhatIsBuzrr,
  alternativeCards,
  cardsForUseCases,
} from "@/components/Marketing/product";
import { COMPETITOR_SLUGS } from "@/data/marketing/competitors";
import { USE_CASES_HUB, ogImageFor } from "@/data/marketing/pages";
import { USE_CASE_SLUGS } from "@/data/marketing/use-cases";
import { siteGraph, webPageSchema } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "What You Can Use Buzrr For";
const DESCRIPTION =
  "Classroom reviews, college fests, training checks, team socials, pub trivia and audience quizzes: how people run live quizzes with Buzrr, and its limits.";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: USE_CASES_HUB.path,
  ogImage: ogImageFor(USE_CASES_HUB),
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Use cases", path: USE_CASES_HUB.path },
];

export default function UseCasesHubPage() {
  return (
    <PageContainer>
      <JsonLd
        nodes={[
          ...siteGraph(),
          webPageSchema({
            path: USE_CASES_HUB.path,
            title: TITLE,
            description: DESCRIPTION,
            type: "CollectionPage",
          }),
          breadcrumbSchema(crumbs),
        ]}
      />
      <PageHero
        crumbs={crumbs}
        eyebrow="Use cases"
        title="What can you use Buzrr for?"
        lead="Anywhere a group of people with phones should answer the same questions at the same time. Each guide below walks through a real session, the features that matter and the limits to know about."
        primary={{ label: "Create a free quiz", href: "/admin" }}
      />

      <WhatIsBuzrr />

      <Section title="Guides by setting">
        <LinkCards items={cardsForUseCases(USE_CASE_SLUGS)} />
      </Section>

      <Section
        title="What every setting gets"
        intro="The same core features apply whether it's a lesson or a pub quiz."
      >
        <FeatureGrid
          ids={[
            "liveRooms",
            "guestPlayers",
            "speedScoring",
            "liveResults",
            "aiQuiz",
            "duels",
          ]}
        />
      </Section>

      <Section title="Switching from another tool">
        <LinkCards items={alternativeCards(COMPETITOR_SLUGS)} />
      </Section>

      <Section title="Run it yourself">
        <LinkCards items={[OPEN_SOURCE_CARD, SELF_HOST_CARD]} />
      </Section>

      <CtaPanel
        title="Start with one quiz"
        text="Sign in with Google, write five questions (or let AI draft them) and host a room."
        primary={{ label: "Create a free quiz", href: "/admin" }}
        secondary={{ label: "Play a 1v1 battle", href: "/duel" }}
      />
    </PageContainer>
  );
}
