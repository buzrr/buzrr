import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BulletList,
  CtaPanel,
  JsonLd,
  LinkCards,
  PageContainer,
  PageHero,
  PointGrid,
  Prose,
  Section,
  Steps,
  breadcrumbSchema,
} from "@/components/Marketing/primitives";
import {
  FeatureGrid,
  OPEN_SOURCE_CARD,
  ProductShots,
  SELF_HOST_CARD,
  WhatIsBuzrr,
  alternativeCards,
  cardsForUseCases,
} from "@/components/Marketing/product";
import { ogImageFor, pageForUseCase } from "@/data/marketing/pages";
import {
  USE_CASES,
  USE_CASE_SLUGS,
  type UseCaseSlug,
} from "@/data/marketing/use-cases";
import { siteGraph, webPageSchema } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return USE_CASE_SLUGS.map((slug) => ({ slug }));
}

type Params = Promise<{ slug: string }>;

function getUseCase(slug: string) {
  return (USE_CASE_SLUGS as string[]).includes(slug)
    ? USE_CASES[slug as UseCaseSlug]
    : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const u = getUseCase((await params).slug);
  if (!u) return {};
  const page = pageForUseCase(u.slug);
  return buildPageMetadata({
    title: u.title,
    description: u.description,
    path: page.path,
    ogImage: ogImageFor(page),
  });
}

export default async function UseCasePage({ params }: { params: Params }) {
  const u = getUseCase((await params).slug);
  if (!u) notFound();
  const page = pageForUseCase(u.slug);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Use cases", path: "/use-cases" },
    { name: u.name, path: page.path },
  ];

  return (
    <PageContainer>
      <JsonLd
        nodes={[
          ...siteGraph(),
          webPageSchema({
            path: page.path,
            title: u.title,
            description: u.description,
          }),
          breadcrumbSchema(crumbs),
        ]}
      />
      <PageHero
        crumbs={crumbs}
        eyebrow={u.name}
        title={u.h1}
        lead={u.lead}
        primary={u.cta}
        secondary={{ label: "See a sample session", href: "#workflow" }}
      />

      <WhatIsBuzrr />

      <Section title={u.problem.heading}>
        <Prose paragraphs={u.problem.paragraphs} />
      </Section>

      <Section title={u.solution.heading}>
        <PointGrid points={u.solution.points} />
      </Section>

      <Section id="workflow" title={u.workflow.heading}>
        <Steps steps={u.workflow.steps.map((text) => ({ text }))} />
      </Section>

      <Section title="Features that matter here">
        <FeatureGrid ids={u.features} />
      </Section>

      <Section title="Tips from running it">
        <BulletList items={u.tips} tone="positive" />
      </Section>

      <Section title="Know the limits">
        <BulletList items={u.watchOut} tone="caution" />
      </Section>

      <Section title="What it looks like">
        <ProductShots />
      </Section>

      <Section title="Coming from another tool?">
        <LinkCards items={alternativeCards(u.alternatives)} />
      </Section>

      <Section title="Related use cases">
        <LinkCards
          items={[
            ...cardsForUseCases(u.related),
            OPEN_SOURCE_CARD,
            SELF_HOST_CARD,
          ]}
        />
      </Section>

      <CtaPanel
        title="Try it with your group"
        text="Buzrr is free to start. Build a quiz, open a room and have people join from their phones."
        primary={u.cta}
        secondary={{ label: "See pricing", href: "/pricing" }}
      />
    </PageContainer>
  );
}
