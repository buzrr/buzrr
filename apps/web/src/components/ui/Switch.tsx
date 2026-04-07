"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
}

export function Switch({ checked, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
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
