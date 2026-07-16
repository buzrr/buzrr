import Link from "next/link";
import { LuGithub, LuHeart, LuInstagram, LuYoutube } from "react-icons/lu";
import ClientImage from "@/components/ClientImage";
import {
  AUTHOR_LINK,
  CONTRIBUTING_LINK,
  GITHUB_LINK,
  INSTAGRAM_LINK,
  LICENSE_LINK,
  SELF_HOSTING_LINK,
  YOUTUBE_LINK,
} from "./links";

const columns = [
  {
    title: "Product",
    links: [
      { name: "Docs", href: "/docs" },
      { name: "Roadmap", href: "/roadmap" },
      { name: "Changelog", href: "/changelog" },
    ],
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
      { name: "Self Hosting", href: SELF_HOSTING_LINK, external: true },
      { name: "License (GPL-3.0)", href: LICENSE_LINK, external: true },
    ],
  },
];

const LandingFooter = () => {
  return (
    <footer className="border-t border-card-light dark:border-card-dark bg-white dark:bg-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
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

        <div className="mt-10 pt-6 border-t border-card-light dark:border-card-dark flex flex-col sm:flex-row items-center justify-between gap-4">
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
            © {new Date().getFullYear()} Buzrr. GPL-3.0 License.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
