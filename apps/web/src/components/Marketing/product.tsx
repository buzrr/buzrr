import Image from "next/image";
import Link from "next/link";
import { LuCheck, LuCircleHelp, LuInfo, LuMinus, LuX } from "react-icons/lu";
import {
  BUZRR_CELLS,
  COMPETITORS,
  FACTS_CHECKED,
  ROW_LABELS,
  alternativePath,
  comparePath,
  type Cell,
  type CompetitorSlug,
  type RowId,
} from "@/data/marketing/competitors";
import {
  FEATURES,
  WHAT_IS_BUZRR,
  type FeatureId,
} from "@/data/marketing/product";
import { USE_CASES, type UseCaseSlug } from "@/data/marketing/use-cases";
import { Answer, type LinkCardItem } from "./primitives";

export function FeatureGrid({ ids }: { ids: FeatureId[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ids.map((id) => {
        const feature = FEATURES[id];
        return (
          <li
            key={id}
            className="rounded-xl border border-card-light dark:border-off-dark bg-white dark:bg-dark p-5"
          >
            <feature.icon
              aria-hidden
              size={22}
              className="text-lprimary dark:text-dprimary"
            />
            <h3 className="mt-3 font-bold text-dark dark:text-white">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm text-dark/70 dark:text-gray leading-relaxed">
              {feature.text}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** The standalone definition; understandable without the rest of the page. */
export function WhatIsBuzrr() {
  return (
    <div className="mb-10">
      <Answer question="What is Buzrr?">
        <p>{WHAT_IS_BUZRR}</p>
      </Answer>
    </div>
  );
}

/**
 * Real product imagery. The dashboard illustration swaps with the theme via
 * CSS (no client JS), unlike `ClientImage`.
 */
export function ProductShots() {
  return (
    <div className="grid gap-6 md:grid-cols-2 items-start">
      <figure className="rounded-2xl border border-card-light dark:border-off-dark bg-white dark:bg-dark p-3">
        <Image
          src="/images/screenshots/buzrr-quiz-editor.jpg"
          alt="Buzrr quiz editor with the quiz title, a Host quiz button, past sessions and a list of multiple-choice questions"
          width={935}
          height={693}
          sizes="(min-width: 768px) 480px, 100vw"
          className="w-full h-auto rounded-xl"
        />
        <figcaption className="mt-3 px-1 text-sm text-dark/70 dark:text-gray">
          The quiz editor: questions on the right, hosting and past sessions on
          the left.
        </figcaption>
      </figure>
      <figure className="rounded-2xl border border-card-light dark:border-off-dark bg-white dark:bg-dark p-3">
        <Image
          src="/images/landing-page.svg"
          alt="Illustration of the Buzrr host dashboard"
          width={448}
          height={270}
          className="w-full h-auto dark:hidden"
        />
        <Image
          src="/images/landing-page-dark.svg"
          alt="Illustration of the Buzrr host dashboard"
          width={448}
          height={270}
          className="w-full h-auto hidden dark:block"
        />
        <figcaption className="mt-3 px-1 text-sm text-dark/70 dark:text-gray">
          Everything runs in the browser, for hosts and players alike.
        </figcaption>
      </figure>
    </div>
  );
}

const STATUS_ICON = {
  yes: {
    icon: LuCheck,
    label: "Yes",
    className: "text-lprimary dark:text-dprimary",
  },
  partial: {
    icon: LuMinus,
    label: "Partly",
    className: "text-dark/60 dark:text-gray",
  },
  no: {
    icon: LuX,
    label: "No",
    className: "text-red-light dark:text-red-dark",
  },
  unverified: {
    icon: LuCircleHelp,
    label: "Not verified",
    className: "text-dark/50 dark:text-gray",
  },
  info: {
    icon: LuInfo,
    label: "Note",
    className: "text-dark/60 dark:text-gray",
  },
} as const;

function CellView({ cell, sourceHref }: { cell: Cell; sourceHref?: string }) {
  const status = STATUS_ICON[cell.status];
  return (
    <span className="flex gap-2">
      <status.icon
        size={16}
        className={`mt-0.5 shrink-0 ${status.className}`}
        aria-label={status.label}
        role="img"
      />
      <span>
        {cell.text}
        {sourceHref && (
          <>
            {" "}
            <a
              href={sourceHref}
              target="_blank"
              rel="noreferrer nofollow"
              className="text-xs underline underline-offset-2 text-dark/60 dark:text-gray hover:text-lprimary dark:hover:text-dprimary"
            >
              source
            </a>
          </>
        )}
      </span>
    </span>
  );
}

/**
 * Buzrr vs one competitor. Buzrr's column is from this repo; the competitor's
 * cells link to the public source they came from, and anything unconfirmed
 * says so.
 */
export function ComparisonTable({
  slug,
  rows,
}: {
  slug: CompetitorSlug;
  rows: RowId[];
}) {
  const competitor = COMPETITORS[slug];
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-card-light dark:border-off-dark bg-white dark:bg-dark">
        <table className="w-full min-w-[640px] text-sm text-left text-dark dark:text-off-white">
          <caption className="sr-only">
            Buzrr compared with {competitor.displayName}
          </caption>
          <thead>
            <tr className="border-b border-card-light dark:border-off-dark text-dark dark:text-white">
              <th scope="col" className="p-4 font-bold w-1/4">
                Feature
              </th>
              <th
                scope="col"
                className="p-4 font-bold text-lprimary dark:text-dprimary"
              >
                Buzrr
              </th>
              <th scope="col" className="p-4 font-bold">
                {competitor.displayName}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const theirs = competitor.cells[row] ?? {
                status: "unverified" as const,
                text: "Not verified",
              };
              return (
                <tr
                  key={row}
                  className="border-b last:border-b-0 border-card-light dark:border-off-dark align-top"
                >
                  <th
                    scope="row"
                    className="p-4 font-semibold text-dark dark:text-white"
                  >
                    {ROW_LABELS[row]}
                  </th>
                  <td className="p-4">
                    <CellView cell={BUZRR_CELLS[row]} />
                  </td>
                  <td className="p-4">
                    <CellView
                      cell={theirs}
                      sourceHref={
                        theirs.source !== undefined
                          ? competitor.sources[theirs.source]?.href
                          : undefined
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-dark/60 dark:text-gray max-w-3xl">
        Buzrr facts come from the Buzrr source code. {competitor.displayName}{" "}
        facts come from the linked public pages, checked {FACTS_CHECKED}.
        &ldquo;Not verified&rdquo; means we couldn&rsquo;t confirm it from a
        public source — not that the feature is missing. Spotted something out
        of date?{" "}
        <a
          href="https://github.com/buzrr/buzrr/issues"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Open an issue
        </a>
        .
      </p>
    </div>
  );
}

export function SourceList({ slug }: { slug: CompetitorSlug }) {
  const competitor = COMPETITORS[slug];
  return (
    <ul className="space-y-1 text-sm">
      {competitor.sources.map((source) => (
        <li key={source.href}>
          <a
            href={source.href}
            target="_blank"
            rel="noreferrer nofollow"
            className="underline underline-offset-2 text-dark/70 dark:text-gray hover:text-lprimary dark:hover:text-dprimary"
          >
            {source.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Internal-link card builders (descriptive anchor text) ---------- */

export function alternativeCards(slugs: CompetitorSlug[]): LinkCardItem[] {
  return slugs.map((slug) => ({
    href: alternativePath(slug),
    title: `${COMPETITORS[slug].displayName} alternative`,
    text: COMPETITORS[slug].alternative.teaser,
  }));
}

export function compareCards(slugs: CompetitorSlug[]): LinkCardItem[] {
  return slugs
    .filter((slug) => COMPETITORS[slug].compare)
    .map((slug) => ({
      href: comparePath(slug),
      title: `Buzrr vs ${COMPETITORS[slug].displayName}`,
      text: COMPETITORS[slug].compare!.teaser,
    }));
}

export function cardsForUseCases(slugs: UseCaseSlug[]): LinkCardItem[] {
  return slugs.map((slug) => ({
    href: `/use-cases/${slug}`,
    title: USE_CASES[slug].h1,
    text: USE_CASES[slug].lead,
  }));
}

export const OPEN_SOURCE_CARD: LinkCardItem = {
  href: "/open-source-quiz-platform",
  title: "Buzrr as an open-source quiz platform",
  text: "What's in the AGPL-3.0 codebase, how it's built, and how to contribute.",
};

export const SELF_HOST_CARD: LinkCardItem = {
  href: "/self-hosted-quiz",
  title: "Run a self-hosted quiz server",
  text: "What you need to run your own Buzrr instance, and what changes when you do.",
};

export function InlineLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-semibold text-lprimary dark:text-dprimary underline underline-offset-4"
    >
      {children}
    </Link>
  );
}
