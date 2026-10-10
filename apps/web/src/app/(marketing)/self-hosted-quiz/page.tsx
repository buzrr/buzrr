import {
  Answer,
  BulletList,
  CtaPanel,
  JsonLd,
  LinkCards,
  PageContainer,
  PageHero,
  Section,
  Steps,
  breadcrumbSchema,
} from "@/components/Marketing/primitives";
import {
  InlineLink,
  OPEN_SOURCE_CARD,
  WhatIsBuzrr,
  alternativeCards,
  cardsForUseCases,
} from "@/components/Marketing/product";
import { SELF_HOST_PAGE, ogImageFor } from "@/data/marketing/pages";
import { PLAN_FACTS } from "@/data/marketing/product";
import { siteGraph, webPageSchema } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { REPO_URL } from "@/lib/seo/site";

const TITLE = "Self-Hosted Quiz Platform: Run Your Own Buzrr";
const DESCRIPTION =
  "Self-host Buzrr, the open-source live quiz platform: requirements (Node.js, PostgreSQL, Redis, Google OAuth), setup commands and production notes.";

export const metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: SELF_HOST_PAGE.path,
  ogImage: ogImageFor(SELF_HOST_PAGE),
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Self-hosted quiz", path: SELF_HOST_PAGE.path },
];

const REQUIRED = [
  "Node.js 18 or newer (20 LTS recommended). Yarn 4 comes via Corepack.",
  "PostgreSQL. Locally, yarn setup starts one in Docker.",
  "Redis. The game server keeps live game state there and won't start without it.",
  "Google OAuth credentials. Google is the only sign-in method, so without them nobody can log in to host.",
  "Somewhere to run a long-lived Node process for the Socket.IO game server — a container or VM host, not a serverless function.",
];

const OPTIONAL = [
  "A Gemini API key, to turn on AI quiz generation.",
  "Cloudinary credentials, for image questions.",
  "Upstash Redis credentials with RATELIMIT=ON, for rate limiting.",
  "The Python AI service (apps/ai) with pgvector, for Knowledge Spaces. Without it, that part of the app stays hidden.",
];

const LOCAL_STEPS = [
  { text: "Install Docker and Node.js, then clone the repository." },
  {
    text: "Run corepack enable, yarn install and yarn setup. Setup starts Postgres and Redis in Docker, writes the .env files with a shared auth secret, and pushes the database schema. It's safe to re-run.",
  },
  {
    text: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to apps/web/.env (redirect URI: http://localhost:3000/api/auth/callback/google).",
  },
  {
    text: "Run yarn dev. The web app is on port 3000 and the API on port 3001.",
  },
];

const PRODUCTION = [
  "Deploy apps/web to a Node host (the repo's own deployment uses Vercel) and apps/server to a container or VM host such as Render, Railway or Fly.",
  "Set BETTER_AUTH_SECRET to the same value on both apps — the web app signs tokens and the server verifies them.",
  "Set WEB_ORIGIN on the server to your site's URL. If it's unset, the API accepts any origin.",
  "Apply the committed migrations with prisma migrate deploy rather than db push.",
  "Seed the 1v1 question pool (yarn workspace @buzrr/prisma seed:duel), or duels will report that there are no questions.",
];

export default function SelfHostedQuizPage() {
  return (
    <PageContainer>
      <JsonLd
        nodes={[
          ...siteGraph(),
          webPageSchema({
            path: SELF_HOST_PAGE.path,
            title: TITLE,
            description: DESCRIPTION,
          }),
          breadcrumbSchema(crumbs),
        ]}
      />
      <PageHero
        crumbs={crumbs}
        eyebrow="Self-hosting"
        title="Run your own live quiz server"
        lead="Buzrr is open source, so you can run the whole thing — live rooms, 1v1 battles, AI generation — on your own infrastructure, with your own database and your own API keys."
        primary={{ label: "Get the code", href: REPO_URL }}
        secondary={{
          label: "Why open source",
          href: "/open-source-quiz-platform",
        }}
      />

      <Answer question="Can Buzrr be self-hosted?">
        <p>
          Yes. Buzrr is AGPL-3.0 open source and the repository includes
          everything needed to run it: a Next.js web app, a NestJS game server,
          a PostgreSQL schema with migrations, and an optional Python AI
          service. It needs PostgreSQL, Redis and Google OAuth credentials.
          Self-hosted instances run with billing off, and every account gets Pro
          limits.
        </p>
      </Answer>

      <div className="mt-6">
        <WhatIsBuzrr />
      </div>

      <Section title="Why teams self-host">
        <BulletList
          items={[
            "Uploaded documents, quizzes and results stay in a database you control.",
            "You can put it on a school, university or company network and review the code before you do.",
            "You can change it — a different scoring curve, a new question type, your own branding — under the AGPL-3.0 terms.",
          ]}
        />
      </Section>

      <Section title="What you need">
        <h3 className="font-bold text-dark dark:text-white mb-3">Required</h3>
        <BulletList items={REQUIRED} />
        <h3 className="mt-8 font-bold text-dark dark:text-white mb-3">
          Optional
        </h3>
        <BulletList items={OPTIONAL} />
      </Section>

      <Section
        title="Run it locally"
        intro="From the repository's README. The whole bootstrap is one script."
      >
        <Steps steps={LOCAL_STEPS} />
        <pre className="mt-6 overflow-x-auto rounded-xl bg-dark text-off-white p-4 text-sm">
          <code>{`git clone ${REPO_URL}.git
cd buzrr
corepack enable
yarn install
yarn setup     # Postgres + Redis in Docker, .env files, schema
# add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to apps/web/.env
yarn dev       # web :3000, api :3001`}</code>
        </pre>
      </Section>

      <Section title="Going to production">
        <BulletList items={PRODUCTION} />
      </Section>

      <Section title="What's different on your own instance">
        <BulletList
          items={[
            `No billing: every account gets Pro limits — ${PLAN_FACTS.proPlayers} players per room, unlimited quizzes and ${PLAN_FACTS.proAiPerWeek} AI generations a week. An operator can raise an individual host's room cap in the database (the hostSizeLimit column).`,
            "AI generation runs on your own Gemini key, so its cost and data handling are between you and Google.",
            "Duel questions come from public quizzes approved in the moderation queue. The API can't grant the superadmin role, so give your own account superadmin in the database to manage moderators.",
            "Bot opponents in 1v1 matchmaking are on by default; set DUEL_BOTS=OFF to disable them.",
          ]}
        />
      </Section>

      <Section title="Know before you start">
        <BulletList
          tone="caution"
          items={[
            "There's no one-click installer or official Docker image for the web and server apps. The bundled docker-compose file only runs the local databases.",
            "Documentation is the README, ARCHITECTURE.md and the docs folder in the repository.",
            "Redis is required for all live play and matchmaking. If it goes down, games stop.",
          ]}
        />
        <p className="mt-4 text-dark/80 dark:text-off-white">
          Rather not run servers? The{" "}
          <InlineLink href="/pricing">hosted version</InlineLink> has a free
          plan.
        </p>
      </Section>

      <Section title="Related pages">
        <LinkCards
          items={[
            OPEN_SOURCE_CARD,
            ...alternativeCards(["kahoot", "slido"]),
            ...cardsForUseCases(["corporate-training", "college-events"]),
          ]}
        />
      </Section>

      <CtaPanel
        title="Clone it and run yarn setup"
        text="Most of the setup is one script. Questions and bug reports go to GitHub issues."
        primary={{ label: "Open the repository", href: REPO_URL }}
        secondary={{ label: "Report an issue", href: `${REPO_URL}/issues` }}
      />
    </PageContainer>
  );
}
