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
  "Self-host Buzrr, the free, open-source live quiz platform, with one docker compose up: local accounts, image storage and optional local AI, even offline.";

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
  "Docker with Compose v2.24 or newer.",
  "About 4 GB of free RAM while the images build, and much less to run them.",
  "Free ports 3000 (web) and 3001 (API). Postgres and Redis are published on localhost only, for backups and debugging.",
];

const OPTIONAL = [
  "A model for AI quiz generation: a Gemini API key, any OpenAI-compatible server, or the bundled Ollama, which runs on your own hardware.",
  "The AI service (the compose ai profile), for Knowledge Spaces. Without it, that part of the app stays hidden.",
  "Google OAuth credentials, if you want Google sign-in alongside local accounts.",
  "An S3-compatible bucket or Cloudinary, if you'd rather not keep question images on a Docker volume.",
];

const LOCAL_STEPS = [
  { text: "Install Docker, then clone the repository." },
  {
    text: "Run docker compose up -d. The first run builds the images and takes a few minutes. It starts Postgres and Redis, applies migrations, seeds starter duel questions and generates the auth secret.",
  },
  {
    text: "Open http://localhost:3000 and create an account. Nothing here calls an outside service.",
  },
];

const PRODUCTION = [
  "Set PUBLIC_WEB_URL and PUBLIC_API_URL to addresses players' devices can reach, in a .env file next to docker-compose.yml, then run docker compose up -d --build. The API address is compiled into the web app, so it needs the rebuild.",
  "For the public internet, put a reverse proxy with HTTPS in front of both ports, such as Caddy, nginx or Traefik.",
  "Never expose Postgres (5432) or Redis (6379) publicly: Postgres uses a default password and Redis has none, and Docker's published ports can bypass host firewalls such as ufw. The compose file binds both to 127.0.0.1, so keep that binding.",
  "Once your hosts have accounts, close registration with AUTH_EMAIL_SIGNUP=OFF.",
  "Back up the Postgres database and the uploads volume. To upgrade, run git pull and docker compose up -d --build; migrations apply before the API starts.",
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
        lead="Buzrr is open source, so you can run the whole thing — live rooms, 1v1 battles, AI generation — on your own infrastructure with one command, even on a network with no internet access."
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
          service. One docker compose up runs the stack with local accounts and
          local image storage, and no outside services. Self-hosted instances
          run with billing off, and every account gets Pro limits.
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
        title="Run it"
        intro="From the repository's self-hosting guide. The whole install is one command."
      >
        <Steps steps={LOCAL_STEPS} />
        <pre className="mt-6 overflow-x-auto rounded-xl bg-dark text-off-white p-4 text-sm">
          <code>{`git clone ${REPO_URL} && cd buzrr
docker compose up -d     # first run builds the images (a few minutes)
# then open http://localhost:3000 and create an account`}</code>
        </pre>
      </Section>

      <Section title="Going to production">
        <BulletList items={PRODUCTION} />
      </Section>

      <Section title="What's different on your own instance">
        <BulletList
          items={[
            `No billing: every account gets Pro limits — ${PLAN_FACTS.proPlayers} players per room, unlimited quizzes, ${PLAN_FACTS.proAiPerWeek} AI generations a week, question images and PDF session reports. An operator can raise an individual host's room cap in the database (the hostSizeLimit column).`,
            "AI stays off until you configure a model. With a local model, nothing leaves your network; with a hosted one, its cost and data handling are between you and that provider.",
            "Duel questions come from public quizzes approved in the moderation queue. The API can't grant the superadmin role, so give your own account superadmin in the database to manage moderators.",
            "Bot opponents in 1v1 matchmaking are on by default; set DUEL_BOTS=OFF to disable them.",
          ]}
        />
      </Section>

      <Section title="Know before you start">
        <BulletList
          tone="caution"
          items={[
            "There are no prebuilt images to pull: the first docker compose up builds them from source.",
            "Local accounts have no password reset, because an offline server can't send email.",
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
        title="Clone it and run docker compose up"
        text="The whole install is one command. Questions and bug reports go to GitHub issues."
        primary={{ label: "Open the repository", href: REPO_URL }}
        secondary={{ label: "Report an issue", href: `${REPO_URL}/issues` }}
      />
    </PageContainer>
  );
}
