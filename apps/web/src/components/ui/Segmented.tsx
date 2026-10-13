"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

/** A small pill-group picker: one of a few values, all visible at once. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
}) {
  return (
    <span
      role="group"
      aria-label={label}
      className="flex shrink-0 gap-1 rounded-[10px] p-[3px] bg-lprimary/8 dark:bg-white/5"
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={clsx(
              "rounded-lg px-2.5 py-[5px] text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap",
              on
                ? "bg-white dark:bg-dark text-dark dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                : "text-off-dark dark:text-muted-dark",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </span>
  );
}

export default Segmented;
