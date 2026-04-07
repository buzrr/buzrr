"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type AccessibleSwitchName =
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never };

export type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
} & AccessibleSwitchName;

export function Switch({
  checked,
  className,
  onClick,
  onCheckedChange,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(event) => {
        onCheckedChange?.(!checked);
        onClick?.(event);
      }}
      className={clsx(
        "w-8 h-5 rounded-full flex items-center p-1 transition-colors",
        checked ? "bg-lprimary dark:bg-dprimary" : "bg-[#abacaf]",
        className
      )}
      {...props}
    >
      <span
        className={clsx(
          "w-3 h-3 bg-white rounded-full transition-[margin-left] duration-200 ease-in-out",
          checked ? "ml-[50%]" : "ml-0"
        )}
      />
    </button>
  );
}

export default Switch;
