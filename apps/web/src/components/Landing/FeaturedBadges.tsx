/* eslint-disable @next/next/no-img-element -- badges are hosted by the directories that list Buzrr */
import type { AnchorHTMLAttributes, ReactNode } from "react";

interface ListingBadge {
  name: string;
  link: AnchorHTMLAttributes<HTMLAnchorElement>;
  content: ReactNode;
}

const BADGES: ListingBadge[] = [
  {
    name: "Product Hunt",
    link: {
      href: "https://www.producthunt.com/products/buzrr?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-buzrr",
      target: "_blank",
      rel: "noopener noreferrer",
      className: "block",
    },
    content: (
      <img
        src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1283224&theme=light&t=1792221342802"
        alt="Buzrr - Build quizzes. Battle friends. | Product Hunt"
        width="220"
        height="48"
        loading="lazy"
      />
    ),
  },
  {
    name: "ScrollLaunch",
    link: {
      href: "https://www.scrolllaunch.com/products/buzrr?ref=badge",
      target: "_blank",
      rel: "noopener",
      className: "block",
    },
    content: (
      <img
        src="https://www.scrolllaunch.com/api/badge/buzrr"
        alt="Featured on ScrollLaunch"
        width="220"
        height="48"
        loading="lazy"
      />
    ),
  },
  {
    name: "launched.tools",
    link: {
      href: "https://launched.tools/tools/buzrr",
      target: "_blank",
      rel: "noopener",
      className:
        "flex items-center gap-2 rounded-[10px] border border-[#D4D7C9] bg-transparent px-3 py-2 font-[sans-serif] no-underline",
    },
    content: (
      <>
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
          <span className="whitespace-nowrap text-xs font-bold text-dark dark:text-white">
            Featured on launched.tools
          </span>
          <span className="text-[10px] text-[#878C79]">REVIEWED ✓</span>
        </span>
      </>
    ),
  },
  {
    name: "FoundrList",
    link: {
      href: "https://www.foundrlist.com/product/buzrr?utm_source=badge&utm_medium=embed",
      target: "_blank",
      rel: "noopener",
      className: "block",
    },
    content: (
      <img
        src="https://www.foundrlist.com/api/badge/buzrr"
        alt="Featured on FoundrList"
        width="150"
        height="48"
        loading="lazy"
      />
    ),
  },
  {
    name: "Uneed",
    link: {
      href: "https://www.uneed.best/tool/buzrr",
      target: "_blank",
      rel: "noopener",
      className: "block",
    },
    content: (
      <>
        <img
          src="https://www.uneed.best/EMBED3B.png"
          alt="Launching Soon on Uneed"
          width="184"
          height="48"
          loading="lazy"
          className="dark:hidden"
        />
        <img
          src="https://www.uneed.best/EMBED3.png"
          alt="Launching Soon on Uneed"
          width="184"
          height="48"
          loading="lazy"
          className="hidden dark:block"
        />
      </>
    ),
  },
  {
    name: "MakeItLast",
    link: {
      href: "https://www.makeitla.st/tools/buzrr",
      title: "Featured on MakeItLast",
    },
    content: (
      <img
        src="https://www.makeitla.st/badge/makeitlast-badge-dark.svg?v=3"
        alt="Featured on MakeItLast"
        width="184"
        height="48"
        loading="lazy"
      />
    ),
  },
];

/**
 * The second copy exists only to make the loop seamless, so it is hidden from
 * assistive tech and the tab order. `pr-8` matches `gap-8`, which keeps the two
 * copies the same width and makes the -50% keyframe land exactly on the seam.
 * Keyboard focus swaps the marquee for a static, wrapped row, as reduced motion
 * does, so the focused badge and its ring are never clipped or carried away.
 */
function BadgeSet({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div
      aria-hidden={duplicate || undefined}
      className={
        duplicate
          ? "flex shrink-0 items-center gap-8 pr-8 motion-reduce:hidden group-has-focus-visible/marquee:hidden"
          : "flex shrink-0 items-center gap-8 pr-8 motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pr-0 group-has-focus-visible/marquee:shrink group-has-focus-visible/marquee:flex-wrap group-has-focus-visible/marquee:justify-center group-has-focus-visible/marquee:pr-0"
      }
    >
      {BADGES.map((badge) => (
        <a
          key={badge.name}
          {...badge.link}
          tabIndex={duplicate ? -1 : undefined}
        >
          {badge.content}
        </a>
      ))}
    </div>
  );
}

export default function FeaturedBadges() {
  return (
    <section aria-labelledby="featured-on-title" className="mt-10">
      <p
        id="featured-on-title"
        className="mb-4 text-center text-2xs font-bold uppercase tracking-[0.2em] text-dark/60 dark:text-gray"
      >
        AS FEATURED ON
      </p>
      <div className="group/marquee overflow-hidden mask-[linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] motion-reduce:mask-none has-focus-visible:overflow-visible has-focus-visible:mask-none">
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:w-full motion-reduce:justify-center has-focus-visible:w-full has-focus-visible:animate-none has-focus-visible:justify-center">
          <BadgeSet />
          <BadgeSet duplicate />
        </div>
      </div>
    </section>
  );
}
