import Link from "next/link";
import {
  LuArrowRight,
  LuBot,
  LuChartColumn,
  LuDoorOpen,
  LuHeart,
  LuPlay,
  LuServer,
  LuSmartphone,
  LuSparkles,
  LuStar,
  LuSwords,
  LuZap,
} from "react-icons/lu";
import LandingNavbar from "@/components/Landing/LandingNavbar";
import LandingFooter from "@/components/Landing/LandingFooter";
import HeroVisual from "@/components/Landing/HeroVisual";
import LandingVideo from "@/components/Landing/LandingVideo";
import { GITHUB_LINK } from "@/components/Landing/links";
import { getGithubStats } from "@/lib/github-stats";
import { JsonLd } from "@/components/Marketing/primitives";
import {
  OPEN_SOURCE_CARD,
  SELF_HOST_CARD,
  cardsForUseCases,
} from "@/components/Marketing/product";
import { WHAT_IS_BUZRR } from "@/data/marketing/product";
import { siteGraph, webPageSchema } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { DEFAULT_TITLE, SITE_DESCRIPTION } from "@/lib/seo/site";

export const metadata = buildPageMetadata({
  title: DEFAULT_TITLE,
  absoluteTitle: true,
  description: SITE_DESCRIPTION,
  path: "/",
});

const heroFacts = [
  "Contributors Welcome",
  "AGPL-3.0 License",
  "TypeScript",
  "Next.js",
  "NestJS",
];

const features = [
  {
    icon: LuZap,
    title: "Realtime Multiplayer",
    text: "Host live rooms players join with a code.",
  },
  {
    icon: LuBot,
    title: "AI Quiz Generator",
    text: "Generate whole quizzes instantly with AI.",
  },
  {
    icon: LuSwords,
    title: "Ranked 1v1 Duels",
    text: "Challenge others in ELO-ranked matches.",
  },
  {
    icon: LuChartColumn,
    title: "Live Results",
    text: "Instant scoring, charts and leaderboards.",
  },
  {
    icon: LuServer,
    title: "Self Host",
    text: "Deploy your own instance, AGPL-3.0 licensed.",
  },
  {
    icon: LuSmartphone,
    title: "Mobile Friendly",
    text: "Play on any device, anywhere.",
  },
];

const moreLinks = [
  {
    href: "/alternatives",
    title:
      "Free alternatives to Kahoot, Wayground (Quizizz), Slido and Mentimeter",
    text: "How Buzrr compares, with sources — and when another tool fits better.",
  },
  OPEN_SOURCE_CARD,
  SELF_HOST_CARD,
];

const formatStat = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("en-US");

const sectionClass =
  "py-16 sm:py-24 border-t border-card-light dark:border-card-dark";
const headingClass =
  "text-3xl sm:text-4xl font-semibold tracking-tight text-dark dark:text-white";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors";
const primaryButtonClass = `${buttonClass} bg-accent hover:bg-accent-deep text-white dark:bg-dprimary dark:hover:bg-off-white dark:text-dark`;
const secondaryButtonClass = `${buttonClass} border border-dark/15 dark:border-white/20 text-dark dark:text-white hover:bg-dark/5 dark:hover:bg-white/10`;

export default async function Home() {
  const stats = await getGithubStats();

  const statTiles = [
    { value: formatStat(stats.contributors), label: "Contributors" },
    { value: formatStat(stats.commits), label: "Commits" },
    { value: formatStat(stats.mergedPRs), label: "PRs Merged" },
    { value: formatStat(stats.stars), label: "GitHub Stars" },
  ];

  return (
    <div className="min-h-dvh bg-light-bg dark:bg-dark-bg">
      <JsonLd
        nodes={[
          ...siteGraph(),
          webPageSchema({
            path: "/",
            title: DEFAULT_TITLE,
            description: SITE_DESCRIPTION,
          }),
        ]}
      />
      <LandingNavbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="relative isolate flex flex-col items-center pt-20 pb-20 sm:pt-28 sm:pb-28 text-center">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_at_top,rgb(125_73_248/0.16),transparent_65%)]"
          />
          <div className="flex flex-col items-center animate-fade-up">
            <span className="flex items-center gap-1.5 rounded-full border border-lprimary/30 dark:border-dprimary/30 bg-lprimary/10 dark:bg-dprimary/10 px-3 py-1 text-xs font-bold text-lprimary dark:text-dprimary">
              <LuSparkles size={13} />
              Open Source
            </span>

            <h1 className="mt-5 text-[13vw] sm:text-7xl lg:text-8xl font-semibold tracking-tighter text-dark dark:text-white leading-[1.02]">
              Build quizzes.
              <br />
              <span className="text-lprimary dark:text-dprimary">
                Battle
              </span>{" "}
              friends.
            </h1>

            <p className="mt-7 text-lg sm:text-xl text-dark/70 dark:text-gray max-w-xl">
              Open-source multiplayer quiz platform for classrooms, communities
              and friends.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link
                href="/duel"
                className={`${primaryButtonClass} w-full sm:w-auto h-12 px-8`}
              >
                <LuPlay size={16} />
                Start 1v1
              </Link>
              <Link
                href="/player"
                className={`${secondaryButtonClass} w-full sm:w-auto h-12 px-8`}
              >
                <LuDoorOpen size={16} />
                Join Room
              </Link>
            </div>

            <Link
              href="/admin"
              className="mt-5 text-sm text-dark/60 dark:text-gray hover:text-lprimary dark:hover:text-dprimary transition-colors underline underline-offset-4"
            >
              or create and host your own quiz →
            </Link>
          </div>

          <div className="mt-16 sm:mt-20 w-full max-w-3xl">
            <HeroVisual />
          </div>

          <ul className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-dark/60 dark:text-muted-dark">
            {heroFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>

        {/* Features */}
        <section className={sectionClass}>
          <h2 className={headingClass}>Everything you need</h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
            {features.map((feature) => (
              <div key={feature.title}>
                <feature.icon
                  className="text-lprimary dark:text-dprimary"
                  size={20}
                />
                <h3 className="mt-4 font-semibold text-dark dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-1 text-sm text-dark/70 dark:text-gray">
                  {feature.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* What is Buzrr + where it fits (internal links to the SEO pages) */}
        <section className={sectionClass}>
          <div className="grid lg:grid-cols-[1fr_2fr] gap-6 lg:gap-12">
            <h2 className={headingClass}>What is Buzrr?</h2>
            <p className="text-lg text-dark/80 dark:text-off-white leading-relaxed">
              {WHAT_IS_BUZRR}
            </p>
          </div>
          <LandingVideo />
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>What people use Buzrr for</h2>
          <ul className="mt-10 grid md:grid-cols-2 md:gap-x-12 border-t border-card-light dark:border-card-dark md:border-t-0">
            {cardsForUseCases([
              "classroom-quizzes",
              "college-events",
              "corporate-training",
              "team-building",
              "pub-trivia",
              "live-audience-quizzes",
            ]).map((item) => (
              <li
                key={item.href}
                className="border-b border-card-light dark:border-card-dark"
              >
                <Link
                  href={item.href}
                  className="group flex items-center justify-between gap-4 py-5 font-medium text-dark dark:text-white hover:text-lprimary dark:hover:text-dprimary transition-colors"
                >
                  {item.title}
                  <LuArrowRight
                    size={16}
                    aria-hidden
                    className="shrink-0 transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-12 grid md:grid-cols-3 gap-8 md:gap-12">
            {moreLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="group block">
                  <span className="font-semibold text-dark dark:text-white group-hover:text-lprimary dark:group-hover:text-dprimary transition-colors">
                    {item.title}
                  </span>
                  <span className="mt-2 block text-sm text-dark/70 dark:text-gray">
                    {item.text}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Built in Public */}
        <section className={sectionClass}>
          <h2 className={headingClass}>Built in Public</h2>
          <dl className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-8">
            {statTiles.map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse gap-1">
                <dt className="text-sm text-dark/60 dark:text-gray">
                  {stat.label}
                </dt>
                <dd className="text-4xl sm:text-5xl font-semibold tracking-tight text-dark dark:text-white">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* GitHub + support CTAs */}
        <section className={`${sectionClass} grid md:grid-cols-2 gap-12`}>
          <div className="flex flex-col items-start">
            <h2 className="text-xl font-semibold text-dark dark:text-white">
              Buzrr is open source and contributor friendly.
            </h2>
            <p className="mt-2 mb-6 text-dark/70 dark:text-gray">
              Free software under AGPL-3.0 — we welcome contributions from
              everyone. Check out our repo!
            </p>
            <a
              href={GITHUB_LINK}
              target="_blank"
              rel="noreferrer"
              className={`${secondaryButtonClass} mt-auto h-11 px-6 text-sm`}
            >
              <LuStar size={14} />
              Star on GitHub
            </a>
          </div>
          <div className="flex flex-col items-start">
            <h2 className="text-xl font-semibold text-dark dark:text-white">
              Enjoying Buzrr? Help keep it running.
            </h2>
            <p className="mt-2 mb-6 text-dark/70 dark:text-gray">
              Donations cover servers and chai — always optional, never
              required.
            </p>
            <Link
              href="/support"
              className={`${secondaryButtonClass} mt-auto h-11 px-6 text-sm`}
            >
              <LuHeart size={14} className="fill-current" />
              Donate Us
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
