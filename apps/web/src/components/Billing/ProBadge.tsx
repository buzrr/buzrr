import clsx from "clsx";

/**
 * "PRO" tag pinned to the top-right corner of a Pro-only control. The parent
 * must be `relative`.
 */
export default function ProBadge({ className }: { className?: string }) {
  return (
    <span
      aria-label="Buzrr Pro feature"
      className={clsx(
        "pointer-events-none absolute -top-2 -right-2 z-10 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.08em] leading-none shadow-sm",
        "bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] text-white dark:from-accent dark:to-accent-deep dark:text-dark",
        className,
      )}
    >
      PRO
    </span>
  );
}
