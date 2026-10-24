import clsx from "clsx";
import type { ReactNode, SVGProps } from "react";
import type { QuestionType } from "@buzrr/contract";

/** Name, one-line description and whether it scores — for menus and tags. */
export const QUESTION_TYPE_META: Record<
  QuestionType,
  { name: string; description: string; scored: boolean }
> = {
  multiple_choice: {
    name: "Multiple choice",
    description: "2–8 options, single or multiple answers",
    scored: true,
  },
  true_false: {
    name: "True / False",
    description: "Quick two-option check",
    scored: true,
  },
  type_answer: {
    name: "Ask for answer",
    description: "Players type it; up to 8 accepted answers, typos forgiven",
    scored: true,
  },
  poll: {
    name: "Poll",
    description: "Collect opinions, no right answer",
    scored: false,
  },
  word_cloud: {
    name: "Word cloud",
    description: "Short answers grouped by frequency",
    scored: false,
  },
  rating: {
    name: "Rating scale",
    description: "1–5 or 1–10 sentiment",
    scored: false,
  },
  open_text: {
    name: "Open text",
    description: "Free responses shown as a wall",
    scored: false,
  },
};

/** Menu order. */
export const QUESTION_TYPE_ORDER: QuestionType[] = [
  "multiple_choice",
  "true_false",
  "type_answer",
  "poll",
  "word_cloud",
  "rating",
  "open_text",
];

const ICONS: Record<QuestionType, { width: number; paths: ReactNode }> = {
  multiple_choice: {
    width: 2,
    paths: (
      <>
        <circle cx="5.5" cy="7" r="1.6" fill="currentColor" />
        <circle cx="5.5" cy="12" r="1.6" />
        <circle cx="5.5" cy="17" r="1.6" />
        <path d="M10 7h10M10 12h10M10 17h10" />
      </>
    ),
  },
  true_false: {
    width: 2,
    paths: (
      <>
        <path d="m3.5 12 3 3 5-6" />
        <path d="M14.5 8.5l6 6M20.5 8.5l-6 6" />
      </>
    ),
  },
  type_answer: {
    width: 2,
    paths: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
      </>
    ),
  },
  poll: { width: 3, paths: <path d="M4 6h9M4 12h15M4 18h6" /> },
  word_cloud: {
    width: 2,
    paths: (
      <path d="M7 18h10.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.3 9.1 4.5 4.5 0 0 0 7 18Z" />
    ),
  },
  rating: {
    width: 2,
    paths: (
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
    ),
  },
  open_text: {
    width: 2,
    paths: (
      <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 4.5h8M8 12.5h5" />
    ),
  },
};

export function QuestionTypeIcon({
  type,
  size = 16,
  ...props
}: { type: QuestionType; size?: number } & SVGProps<SVGSVGElement>) {
  const icon = ICONS[type];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={icon.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {icon.paths}
    </svg>
  );
}

/** "POLL" pill with the type's icon, as on the game screens. */
export function QuestionTypePill({
  type,
  className,
}: {
  type: QuestionType;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex w-fit items-center gap-1.5 text-[12.5px] font-bold tracking-[0.06em] uppercase rounded-full px-3 py-1.5 text-lprimary dark:text-dprimary bg-lprimary/8 dark:bg-white/5",
        className,
      )}
    >
      <QuestionTypeIcon type={type} size={14} />
      {QUESTION_TYPE_META[type].name}
    </span>
  );
}
