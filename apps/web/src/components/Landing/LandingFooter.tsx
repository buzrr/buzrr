import Link from "next/link";
import { LuGithub, LuHeart, LuInstagram, LuYoutube } from "react-icons/lu";
import ClientImage from "@/components/ClientImage";
import { LEGAL_PAGES } from "@/data/legal";
import {
  COMPARE_SLUGS,
  COMPETITORS,
  COMPETITOR_SLUGS,
  alternativePath,
  comparePath,
} from "@/data/marketing/competitors";
import { USE_CASES, USE_CASE_SLUGS } from "@/data/marketing/use-cases";
import {
  AUTHOR_LINK,
  CONTRIBUTING_LINK,
  GITHUB_LINK,
  INSTAGRAM_LINK,
  LICENSE_LINK,
  YOUTUBE_LINK,
} from "./links";

const columns = [
  {
    title: "Product",
    links: [
      { name: "Pricing", href: "/pricing" },
      { name: "Docs", href: "/docs" },
      { name: "Open-source quiz platform", href: "/open-source-quiz-platform" },
      { name: "Self-hosted quiz", href: "/self-hosted-quiz" },
    ],
  },
  {
    title: "Alternatives",
    links: [
      { name: "All alternatives", href: "/alternatives" },
      ...COMPETITOR_SLUGS.map((slug) => ({
        name: `${COMPETITORS[slug].searchName} alternative`,
        href: alternativePath(slug),
      })),
    ],
  },
  {
    title: "Compare",
    links: COMPARE_SLUGS.map((slug) => ({
      name: `Buzrr vs ${COMPETITORS[slug].searchName}`,
      href: comparePath(slug),
    })),
  },
  {
    title: "Use cases",
    links: USE_CASE_SLUGS.map((slug) => ({
      name: USE_CASES[slug].name,
      href: `/use-cases/${slug}`,
    })),
  },
  {
    title: "Community",
    links: [
      { name: "GitHub", href: GITHUB_LINK, external: true },
      { name: "Instagram", href: INSTAGRAM_LINK, external: true },
      { name: "YouTube", href: YOUTUBE_LINK, external: true },
    ],
  },
  {
    title: "Resources",
    links: [
      { name: "Contributing", href: CONTRIBUTING_LINK, external: true },
      { name: "License (AGPL-3.0)", href: LICENSE_LINK, external: true },
      ...LEGAL_PAGES.map((page) => ({ name: page.name, href: page.path })),
    ],
  },
];

const LandingFooter = () => {
  return (
    <footer className="border-t border-card-light dark:border-card-dark bg-white dark:bg-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8">
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <ClientImage
              props={{
                src: "/images/logo.svg",
                darksrc: "/images/logo-dark.svg",
                alt: "Buzrr Logo",
                width: 90,
                height: 90,
              }}
            />
            <p className="mt-3 text-sm text-dark/70 dark:text-gray max-w-xs">
              Open-source quiz platform for everyone. 1v1 duels, live
              multiplayer rooms and AI-generated quizzes.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-bold text-dark dark:text-white mb-3">
                {col.title}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) =>
                  "external" in link && link.external ? (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-dark/70 dark:text-gray hover:text-lprimary dark:hover:text-dprimary transition-colors"
                      >
                        {link.name}
                      </a>
                    </li>
                  ) : (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="text-sm text-dark/70 dark:text-gray hover:text-lprimary dark:hover:text-dprimary transition-colors"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center sm:justify-start gap-3">
          <a
            href="https://www.producthunt.com/products/buzrr?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-buzrr"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1283224&theme=light&t=1792221342802"
              alt="Buzrr - Build quizzes. Battle friends. | Product Hunt"
              width="220"
              height="48"
              loading="lazy"
            />
          </a>
          <a
            href="https://www.scrolllaunch.com/products/buzrr?ref=badge"
            target="_blank"
            rel="noopener"
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.scrolllaunch.com/api/badge/buzrr"
              alt="Featured on ScrollLaunch"
              width="220"
              height="48"
              loading="lazy"
            />
          </a>
          <a
            href="https://launched.tools/tools/buzrr"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 rounded-[10px] border border-[#D4D7C9] bg-transparent px-3 py-2 font-[sans-serif] no-underline"
          >
            <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md bg-[#C6F94E]">
              <svg
                width="13"
                height="13"
                viewBox="128 120 264 264"
                aria-hidden="true"
              >
                <path d="M214 120 L392 120 L392 298 Z" fill="#15170F" />
                <path
                  d="M156 356 L322 190"
                  stroke="#15170F"
                  strokeWidth="78"
                  fill="none"
                />
              </svg>
            </span>
            <span className="flex flex-col leading-[1.2]">
              <span className="text-xs font-bold text-dark dark:text-white">
                Featured on launched.tools
              </span>
              <span className="text-[10px] text-[#878C79]">REVIEWED ✓</span>
            </span>
          </a>
          <a
            href="https://www.foundrlist.com/product/buzrr?utm_source=badge&utm_medium=embed"
            target="_blank"
            rel="noopener"
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.foundrlist.com/api/badge/buzrr"
              alt="Featured on FoundrList"
              width="150"
              height="48"
              loading="lazy"
            />
          </a>
          <a
            href="https://www.uneed.best/tool/buzrr"
            target="_blank"
            rel="noopener"
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.uneed.best/EMBED3B.png"
              alt="Launching Soon on Uneed"
              width="184"
              height="48"
              loading="lazy"
              className="dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.uneed.best/EMBED3.png"
              alt="Launching Soon on Uneed"
              width="184"
              height="48"
              loading="lazy"
              className="hidden dark:block"
            />
          </a>
          <a href="https://www.makeitla.st/" title="Featured on MakeItLast">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.makeitla.st/badge/makeitlast-badge-dark.svg?v=3"
              alt="Featured on MakeItLast"
              width="184"
              height="48"
            />
          </a>
        </div>

        <div className="mt-6 pt-6 border-t border-card-light dark:border-card-dark flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="flex items-center gap-1.5 text-sm text-dark/70 dark:text-gray">
            Made with
            <LuHeart
              className="text-lprimary dark:text-dprimary fill-current"
              size={14}
            />
            by{" "}
            <a
              href={AUTHOR_LINK}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-lprimary dark:text-dprimary"
            >
              Alan Ansari
            </a>
          </p>
          <div className="flex items-center gap-4 text-dark/70 dark:text-gray">
            <a
              href={GITHUB_LINK}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="hover:text-lprimary dark:hover:text-dprimary transition-colors"
            >
              <LuGithub size={18} />
            </a>
            <a
              href={INSTAGRAM_LINK}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="hover:text-lprimary dark:hover:text-dprimary transition-colors"
            >
              <LuInstagram size={18} />
            </a>
            <a
              href={YOUTUBE_LINK}
              target="_blank"
              rel="noreferrer"
              aria-label="YouTube"
              className="hover:text-lprimary dark:hover:text-dprimary transition-colors"
            >
              <LuYoutube size={18} />
            </a>
          </div>
          <p className="text-sm text-dark/70 dark:text-gray">
            © {new Date().getFullYear()} Buzrr. AGPL-3.0 License.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
