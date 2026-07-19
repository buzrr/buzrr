import type { Metadata } from "next";
import { LuCoffee, LuGithub, LuHeart } from "react-icons/lu";
import LandingNavbar from "@/components/Landing/LandingNavbar";
import LandingFooter from "@/components/Landing/LandingFooter";
import {
  CONTRIBUTING_LINK,
  GITHUB_LINK,
  ISSUES_LINK,
} from "@/components/Landing/links";
import supportLinks from "@/data/support-links.json";

export const metadata: Metadata = {
  title: "❤️ Support Buzrr",
  description: "Help keep Buzrr open source and growing.",
};

const stats = [
  { title: "Open Source", subtitle: "Always free" },
  { title: "Maintainer", subtitle: "1 developer" },
  { title: "Users", subtitle: "Community driven" },
  { title: "Every donation", subtitle: "Directly supports development" },
];

const supportGoesTo = [
  { emoji: "☕", text: "Chai for late-night coding sessions" },
  { emoji: "🍪", text: "Snacks that mysteriously disappear during debugging" },
  { emoji: "☁️", text: "Servers, databases, storage and bandwidth" },
  { emoji: "📧", text: "Monitoring, email services and infrastructure" },
  { emoji: "🚀", text: "Building new features and fixing bugs" },
];

const otherWays = [
  { emoji: "⭐", text: "Star the GitHub repository", href: GITHUB_LINK },
  { emoji: "🐛", text: "Report bugs", href: ISSUES_LINK },
  { emoji: "💡", text: "Suggest features", href: ISSUES_LINK },
  { emoji: "🔧", text: "Contribute code", href: CONTRIBUTING_LINK },
  {
    emoji: "📢",
    text: "Share Buzrr with your school, company or friends",
    href: null,
  },
];

const cardClass =
  "rounded-xl border border-card-light dark:border-off-dark bg-white dark:bg-dark";

export default function SupportPage() {
  return (
    <div className="min-h-dvh bg-light-bg dark:bg-dark-bg">
      <LandingNavbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="flex flex-col items-center text-center pt-14 pb-12 sm:pt-20">
          <h1 className="text-4xl sm:text-5xl font-black text-dark dark:text-white leading-tight">
            Support{" "}
            <span className="text-lprimary dark:text-dprimary">Buzrr</span>
          </h1>
          <p className="mt-3 text-sm font-semibold text-dark/60 dark:text-gray">
            Help keep Buzrr open source and growing.
          </p>
          <p className="mt-6 text-base sm:text-lg text-dark/70 dark:text-gray max-w-2xl">
            Buzrr is an open-source alternative to Kahoot and QuizUp, built
            during countless late-night coding sessions and maintained for the
            community.
          </p>
          <p className="mt-4 text-base sm:text-lg text-dark/70 dark:text-gray max-w-2xl">
            If Buzrr has helped you host quizzes, classrooms, hackathons, or
            events, consider supporting the project. Your contribution helps
            keep the project sustainable and lets me spend more time building
            new features instead of worrying about infrastructure costs.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <a
              href={supportLinks.githubSponsors}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 rounded-xl text-lg font-black bg-lprimary dark:bg-dprimary text-white dark:text-dark hover:opacity-90 transition-opacity"
            >
              ❤️ Sponsor on GitHub
            </a>
            <a
              href={supportLinks.buyMeAChai}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 rounded-xl text-lg font-black border-2 border-lprimary dark:border-dprimary text-lprimary dark:text-dprimary hover:bg-lprimary/10 dark:hover:bg-dprimary/10 transition-colors"
            >
              ☕ Buy me a chai (India)
            </a>
          </div>
        </section>

        {/* Stats */}
        <section className="pb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.title}
                className={`${cardClass} flex flex-col items-center text-center gap-1 p-5`}
              >
                <p className="text-sm font-bold text-dark dark:text-white">
                  {stat.title}
                </p>
                <p className="text-xs text-dark/60 dark:text-gray">
                  {stat.subtitle}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Where your support goes */}
        <section className="pb-12">
          <div className={`${cardClass} p-6 sm:p-8`}>
            <h2 className="text-xl sm:text-2xl font-black text-dark dark:text-white">
              Where your support goes
            </h2>
            <ul className="mt-5 space-y-3">
              {supportGoesTo.map((item) => (
                <li
                  key={item.text}
                  className="flex items-start gap-3 text-sm sm:text-base text-dark/80 dark:text-gray"
                >
                  <span aria-hidden className="shrink-0">
                    {item.emoji}
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-dark/60 dark:text-gray border-t border-card-light dark:border-off-dark pt-4">
              Right now, most donations simply help keep Buzrr online and allow
              me to continue improving it consistently.
            </p>
          </div>
        </section>

        {/* Ways to Support */}
        <section className="pb-12">
          <h2 className="text-center text-xl sm:text-2xl font-black text-dark dark:text-white mb-6">
            Ways to Support
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className={`${cardClass} flex flex-col items-start p-6`}>
              <span className="flex items-center justify-center size-11 rounded-full bg-card-light dark:bg-card-dark text-dark dark:text-white">
                <LuGithub size={22} />
              </span>
              <h3 className="mt-4 font-bold text-dark dark:text-white">
                GitHub Sponsors
              </h3>
              <p className="mt-1 text-sm text-dark/60 dark:text-gray">
                The best way to support ongoing development.
              </p>
              <a
                href={supportLinks.githubSponsors}
                target="_blank"
                rel="noreferrer"
                className="mt-5 w-full text-center px-5 py-2.5 rounded-xl font-bold bg-lprimary dark:bg-dprimary text-white dark:text-dark hover:opacity-90 transition-opacity"
              >
                Sponsor on GitHub
              </a>
            </div>

            <div className={`${cardClass} flex flex-col items-start p-6`}>
              <span className="flex items-center justify-center size-11 rounded-full bg-card-light dark:bg-card-dark text-dark dark:text-white">
                <LuCoffee size={22} />
              </span>
              <h3 className="mt-4 font-bold text-dark dark:text-white">
                Buy me a Chai (India)
              </h3>
              <p className="mt-1 text-sm text-dark/60 dark:text-gray">
                Quick UPI support for anyone in India.
              </p>
              <a
                href={supportLinks.buyMeAChai}
                target="_blank"
                rel="noreferrer"
                className="mt-5 w-full text-center px-5 py-2.5 rounded-xl font-bold border-2 border-lprimary dark:border-dprimary text-lprimary dark:text-dprimary hover:bg-lprimary/10 dark:hover:bg-dprimary/10 transition-colors"
              >
                Donate via UPI
              </a>
            </div>
          </div>
        </section>

        {/* Can't donate? */}
        <section className="pb-12">
          <h2 className="text-center text-xl sm:text-2xl font-black text-dark dark:text-white mb-6">
            You can still help ❤️
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {otherWays.map((item) =>
              item.href ? (
                <a
                  key={item.text}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`${cardClass} flex flex-col items-center text-center gap-2 p-5 hover:border-lprimary/40 dark:hover:border-dprimary/40 hover:-translate-y-0.5 transition-all`}
                >
                  <span aria-hidden className="text-xl">
                    {item.emoji}
                  </span>
                  <p className="text-sm font-semibold text-dark dark:text-white">
                    {item.text}
                  </p>
                </a>
              ) : (
                <div
                  key={item.text}
                  className={`${cardClass} flex flex-col items-center text-center gap-2 p-5`}
                >
                  <span aria-hidden className="text-xl">
                    {item.emoji}
                  </span>
                  <p className="text-sm font-semibold text-dark dark:text-white">
                    {item.text}
                  </p>
                </div>
              ),
            )}
          </div>
          <p className="mt-6 text-center text-sm text-dark/60 dark:text-gray">
            These contributions are just as valuable and help Buzrr grow.
          </p>
        </section>

        {/* Transparency */}
        <section className="pb-12">
          <div className="rounded-xl border-2 border-lprimary/30 dark:border-dprimary/30 bg-lprimary/5 dark:bg-dprimary/5 p-6 sm:p-8">
            <h2 className="text-xl font-black text-dark dark:text-white">
              Transparency
            </h2>
            <p className="mt-3 font-semibold text-dark dark:text-white">
              Buzrr will always remain open source.
            </p>
            <p className="mt-2 text-sm sm:text-base text-dark/70 dark:text-gray">
              Donations are completely optional. They never unlock features or
              create a better experience for donors. Every contribution simply
              helps keep the project sustainable and allows more time to be
              invested into improving it for everyone.
            </p>
          </div>
        </section>

        {/* Footer note */}
        <section className="pb-16 flex flex-col items-center text-center">
          <span className="flex items-center justify-center size-11 rounded-full bg-card-light dark:bg-card-dark text-lprimary dark:text-dprimary">
            <LuHeart size={22} className="fill-current" />
          </span>
          <h2 className="mt-4 text-xl font-black text-dark dark:text-white">
            Thank you ❤️
          </h2>
          <p className="mt-2 text-sm sm:text-base text-dark/70 dark:text-gray max-w-xl">
            Whether you contribute code, report bugs, share Buzrr, or simply buy
            me a chai, you&apos;re helping make open-source quiz software better
            for everyone.
          </p>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
