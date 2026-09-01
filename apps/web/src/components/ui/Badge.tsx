"use client";

import clsx from "clsx";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

/**
 * Pill label. The tone palette matches `StatusPill` in
 * `Admin/Moderation/ModerationQueueClient.tsx` so moderation states and
 * ingestion states read the same way.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-gray/20 text-off-dark dark:text-off-white",
  info: "bg-lprimary/15 text-lprimary dark:bg-dprimary/20 dark:text-dprimary",
  success: "bg-[#20A97C]/20 text-[#20A97C]",
  warning: "bg-[#F2AB53]/20 text-[#F2AB53]",
  danger:
    "bg-red-light/20 dark:bg-red-dark/20 text-red-light dark:text-red-dark",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
