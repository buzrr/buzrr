import { LuArrowRight } from "react-icons/lu";
import LandingNavbar from "./LandingNavbar";
import LandingFooter from "./LandingFooter";

interface ComingSoonProps {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

const ComingSoon = ({
  title,
  description,
  ctaLabel,
  ctaHref,
}: ComingSoonProps) => {
  return (
    <div className="min-h-dvh flex flex-col bg-light-bg dark:bg-dark-bg">
      <LandingNavbar />
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 animate-fade-up">
        <span className="rounded-full border border-lprimary/30 dark:border-dprimary/30 bg-lprimary/10 dark:bg-dprimary/10 px-3 py-1 text-xs font-bold text-lprimary dark:text-dprimary">
          Coming Soon
        </span>
        <h1 className="mt-5 text-4xl sm:text-5xl font-black text-dark dark:text-white">
          {title}
        </h1>
        <p className="mt-4 max-w-md text-dark/70 dark:text-gray">
          {description}
        </p>
        <a
          href={ctaHref}
          target="_blank"
          rel="noreferrer"
          className="mt-8 flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-lprimary dark:bg-dprimary text-white dark:text-dark hover:opacity-90 transition-opacity"
        >
          {ctaLabel}
          <LuArrowRight size={16} />
        </a>
      </main>
      <LandingFooter />
    </div>
  );
};

export default ComingSoon;
