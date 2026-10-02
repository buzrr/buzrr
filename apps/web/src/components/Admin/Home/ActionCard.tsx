"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

type ActionCardVariant = "default" | "ai" | "soon";

export default function ActionCard({
  icon,
  title,
  subtitle,
  view,
  variant = "default",
  href,
  onClick,
  className,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  view: "grid" | "list";
  variant?: ActionCardVariant;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const classes = clsx(
    "relative overflow-hidden rounded-[18px] border text-left flex gap-3.5 transition-[transform,box-shadow,background-color] duration-150 ease-out",
    view === "grid"
      ? "flex-col p-4 md:p-[22px] min-h-[124px]"
      : "flex-row items-center p-4",
    variant === "ai"
      ? "bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] border-transparent text-white"
      : "bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5 text-dark dark:text-white",
    variant === "soon"
      ? "opacity-85 cursor-default"
      : "cursor-pointer hover:-translate-y-[3px] hover:shadow-[0_14px_30px_-14px_rgba(0,0,0,0.5)]",
    className,
  );

  const body = (
    <>
      {variant === "soon" && (
        <span className="absolute top-3 right-3 md:top-4 md:right-4 text-[10.5px] font-semibold tracking-[0.04em] uppercase rounded-full px-2.5 py-1 bg-lprimary/10 dark:bg-white/5 text-off-dark dark:text-[#9a9aa2]">
          Soon
        </span>
      )}
      <span
        className={clsx(
          "size-10 md:size-[46px] shrink-0 rounded-xl flex items-center justify-center [&>svg]:size-5 md:[&>svg]:size-6",
          variant === "ai"
            ? "bg-white/20 text-white"
            : "bg-lprimary/10 dark:bg-white/5 text-lprimary dark:text-dprimary",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm md:text-base font-semibold">
          {title}
        </span>
        <span
          className={clsx(
            "block text-xs md:text-[13.5px]",
            variant === "ai"
              ? "text-white/85"
              : "text-off-dark dark:text-[#9a9aa2]",
          )}
        >
          {subtitle}
        </span>
      </span>
    </>
  );

  if (variant === "soon") {
    return (
      <div aria-disabled="true" className={classes}>
        {body}
      </div>
    );
  }
  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {body}
    </button>
  );
}
