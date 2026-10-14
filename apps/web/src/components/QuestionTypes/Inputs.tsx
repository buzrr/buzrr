"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { LuCheck } from "react-icons/lu";
import {
  OptionKey,
  primaryButtonClass,
  subtleCardClass,
} from "@/components/Game/GameUI";

// Player-side building blocks for the types that answer with a Submit
// button rather than a single tap.

export function SubmitButton({
  disabled,
  onClick,
  children = "Submit",
}: {
  disabled: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(primaryButtonClass, "w-full mt-5 md:mt-6")}
    >
      {children}
    </button>
  );
}

/** Options to pick one (radio) or several (checkbox) of, before submitting. */
export function ChoiceList({
  options,
  multi,
  chosen,
  disabled,
  onToggle,
}: {
  options: { id: string; title: string }[];
  multi: boolean;
  chosen: string[];
  disabled: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      role={multi ? "group" : "radiogroup"}
      className="flex flex-col gap-2.5 md:gap-3 mt-4 md:mt-7"
    >
      {options.map((option, i) => {
        const on = chosen.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            disabled={disabled}
            onClick={() => onToggle(option.id)}
            className={clsx(
              "flex items-center gap-3.5 rounded-2xl border-[1.5px] px-3.5 py-3 md:px-[18px] md:py-4 text-base md:text-lg font-semibold text-left wrap-break-word min-w-0 transition-all duration-150",
              on
                ? "border-lprimary dark:border-dprimary bg-lprimary/10 dark:bg-dprimary/15"
                : subtleCardClass,
              !disabled && "cursor-pointer hover:border-dprimary",
              disabled && !on && "opacity-50 cursor-default",
            )}
          >
            <OptionKey
              index={i}
              className="size-9 text-[15px] rounded-[10px]"
            />
            <span className="min-w-0 flex-1">{option.title}</span>
            {multi ? (
              <span
                className={clsx(
                  "shrink-0 size-[22px] rounded-md border-2 flex items-center justify-center text-white",
                  on
                    ? "bg-lprimary dark:bg-dprimary border-lprimary dark:border-dprimary"
                    : "border-lprimary/25 dark:border-white/20",
                )}
              >
                {on && <LuCheck size={14} strokeWidth={3} />}
              </span>
            ) : (
              <span
                className={clsx(
                  "shrink-0 size-[22px] rounded-full",
                  on
                    ? "border-[7px] border-lprimary dark:border-dprimary"
                    : "border-2 border-lprimary/25 dark:border-white/20",
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Toggles an id in a pick list; a single-choice list holds at most one. */
export function toggleChoice(
  chosen: string[],
  id: string,
  multi: boolean,
): string[] {
  if (!multi) return [id];
  return chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id];
}
