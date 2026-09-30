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
  breadcrumbSchema,
} from "@/components/Marketing/primitives";
import {
  FeatureGrid,
  InlineLink,
  SELF_HOST_CARD,
  WhatIsBuzrr,
  alternativeCards,
  cardsForUseCases,
} from "@/components/Marketing/product";
import { OPEN_SOURCE_PAGE, ogImageFor } from "@/data/marketing/pages";
import { siteGraph, sourceCodeSchema, webPageSchema } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { LICENSE_URL, REPO_URL } from "@/lib/seo/site";

const TITLE = "Open-Source Quiz Platform (GPL-3.0)";
const DESCRIPTION =
  "Buzrr is a GPL-3.0 open-source quiz platform — live quiz rooms, ranked 1v1 battles, AI questions — built on Next.js, NestJS, Socket.IO, Postgres and Redis.";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: OPEN_SOURCE_PAGE.path,
  ogImage: ogImageFor(OPEN_SOURCE_PAGE),
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Open-source quiz platform", path: OPEN_SOURCE_PAGE.path },
];

const REPO_PARTS = [
  {
    path: "apps/web",
    stack: "Next.js 15, React 19",
    role: "The website and every screen — host, player and duel. Also hosts sign-in (Better Auth with Google).",
  },
  {
    path: "apps/server",
    stack: "NestJS 11, Socket.IO",
    role: "REST API, the WebSocket gateway and the game engine that runs every timer, phase change and score.",
  },
  {
    path: "apps/ai",
    stack: "Python 3.12, FastAPI, arq",
    role: "Optional. Knowledge Spaces: document ingestion, pgvector retrieval and cited question generation.",
  },
  {
    path: "packages/prisma",
    stack: "Prisma, PostgreSQL",
    role: "The database schema, migrations and the shared client.",
  },
];

const ENGINEERING = [
  {
    title: "The server owns the game",
    text: "Clients only send intent — start, next, submit answer. Timing, phase transitions and scoring all happen on the server, so a slow or modified client can't bend the rules.",
  },
  {
    title: "The server owns the clock",
    text: "Answer time is measured by the server from when the question opened, and deadlines go to clients as durations, so device clock drift doesn't change anyone's score.",
  },
  {
    title: "Live state in Redis, results in Postgres",
    text: "A running game lives in Redis. Postgres only stores the room record and the finished result, keeping the database out of the hot path.",
  },
  {
    title: "Built for more than one server",
    text: "Socket.IO uses the Redis adapter, and each game's timers are owned through a Redis lock, so several server instances can run side by side.",
  },
];

export default function OpenSourcePage() {
  return (
    <PageContainer>
      <JsonLd
        nodes={[
          ...siteGraph(),
          sourceCodeSchema(),
          webPageSchema({
            path: OPEN_SOURCE_PAGE.path,
            title: TITLE,
            description: DESCRIPTION,
          }),
          breadcrumbSchema(crumbs),
        ]}
      />
      <PageHero
        crumbs={crumbs}
        eyebrow="Open source · GPL-3.0"
        title="An open-source quiz platform you can read, run and change"
        lead="Every part of Buzrr — the website, the real-time game server and the AI service — is public on GitHub. Use the hosted version at buzrr.in, or take the code and run it yourself."
        primary={{ label: "View the code on GitHub", href: REPO_URL }}
        secondary={{ label: "Try the hosted version", href: "/admin" }}
      />

      <Answer question="Is Buzrr open source?">
        <p>
          Yes. Buzrr is licensed under the GNU General Public License v3.0
          (GPL-3.0). The complete source is at{" "}
          <a
            href={REPO_URL}
            className="underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            github.com/buzrr/buzrr
          </a>
          . You can use, study, modify and share it; if you distribute a
          modified version, you must release its source under the same license.
          The{" "}
          <a
            href={LICENSE_URL}
            className="underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            license text
          </a>{" "}
          has the details.
        </p>
      </Answer>

      <div className="mt-6">
        <WhatIsBuzrr />
      </div>

      <Section
        title="What's in the repository"
        intro="A Turborepo monorepo with Yarn 4 workspaces. The Python service is optional; the rest is TypeScript."
      >
        <div className="overflow-x-auto rounded-2xl border border-card-light dark:border-off-dark bg-white dark:bg-dark">
          <table className="w-full min-w-[560px] text-sm text-left text-dark dark:text-off-white">
            <caption className="sr-only">Buzrr repository layout</caption>
            <thead>
              <tr className="border-b border-card-light dark:border-off-dark text-dark dark:text-white">
                <th scope="col" className="p-4 font-bold">
                  Path
                </th>
                <th scope="col" className="p-4 font-bold">
                  Stack
                </th>
                <th scope="col" className="p-4 font-bold">
                  What it does
                </th>
              </tr>
            </thead>
            <tbody>
              {REPO_PARTS.map((part) => (
                <tr
                  key={part.path}
                  className="border-b last:border-b-0 border-card-light dark:border-off-dark align-top"
                >
                  <th
                    scope="row"
                    className="p-4 font-mono text-xs font-semibold"
                  >
                    {part.path}
                  </th>
                  <td className="p-4 whitespace-nowrap">{part.stack}</td>
                  <td className="p-4">{part.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="How the game engine is built"
        intro="The design decisions that make a live quiz fair, from the repository's ARCHITECTURE.md."
      >
        <PointGrid points={ENGINEERING} />
        <p className="mt-4 text-dark/80 dark:text-off-white">
          Read the full write-up in{" "}
          <a
            href={`${REPO_URL}/blob/main/ARCHITECTURE.md`}
            className="font-semibold text-lprimary dark:text-dprimary underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            ARCHITECTURE.md on GitHub
          </a>
          .
        </p>
      </Section>

      <Section title="What the open-source code gives you">
        <FeatureGrid
          ids={[
            "liveRooms",
            "duels",
            "aiQuiz",
            "knowledgeSpaces",
            "speedScoring",
            "selfHost",
          ]}
        />
      </Section>

      <Section title="Open source and Buzrr Pro">
        <BulletList
          items={[
            "The hosted version at buzrr.in has a free plan and an optional Pro subscription. Pro pays for the hosted infrastructure.",
            "Billing is switched off unless an instance sets BILLING=ON. Self-hosted instances run without a payment provider, and every account gets Pro limits.",
            "Nothing is held back from the repository: the billing code is in it too, behind that switch.",
          ]}
        />
      </Section>

      <Section title="Contributing">
        <BulletList
          items={[
            "Fork the repo, branch off main and open a pull request — the steps are in CONTRIBUTING.md.",
            "Commits follow Conventional Commits (feat:, fix:, docs:…). A pre-commit hook runs lint and type checks.",
            "Architecture docs and decision records live in the repo, so you can see why things are built the way they are before changing them.",
            "Bugs and ideas go to GitHub issues.",
          ]}
        />
        <p className="mt-4 text-dark/80 dark:text-off-white">
          Want to run it rather than change it? See{" "}
          <InlineLink href="/self-hosted-quiz">
            how to self-host Buzrr
          </InlineLink>
          .
        </p>
      </Section>

      <Section title="Looking for an open-source alternative?">
        <LinkCards
          items={[
            ...alternativeCards(["kahoot", "quizizz", "quizup"]),
            SELF_HOST_CARD,
          ]}
        />
      </Section>

      <Section title="What people run on it">
        <LinkCards
          items={cardsForUseCases([
            "classroom-quizzes",
            "college-events",
            "corporate-training",
          ])}
        />
      </Section>

      <CtaPanel
        title="Star it, fork it, or just play"
        text="The code is on GitHub. The hosted version is free to start."
        primary={{ label: "Open the GitHub repo", href: REPO_URL }}
        secondary={{ label: "Create a quiz", href: "/admin" }}
      />
    </PageContainer>
  );
}
