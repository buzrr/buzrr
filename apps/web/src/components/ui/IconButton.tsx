"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
}

export function IconButton({ icon, className, type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center rounded-md p-2 transition-colors",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
}

export default IconButton;
