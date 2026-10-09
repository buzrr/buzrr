"use client";

import clsx from "clsx";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 8;
const EDGE = 12;

/**
 * Hover/focus tooltip rendered into a portal so it isn't clipped by scrolling
 * panels. The trigger is a `<span>` that takes `className`, so it can be the
 * truncated element itself; with `onlyWhenTruncated` the tooltip only appears
 * when that span's text is actually cut off.
 */
export function Tooltip({
  content,
  onlyWhenTruncated = false,
  className,
  children,
}: {
  content: React.ReactNode;
  onlyWhenTruncated?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>();

  function show() {
    const el = triggerRef.current;
    if (!el) return;
    if (onlyWhenTruncated && el.scrollWidth <= el.clientWidth) return;
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    setPos(undefined);
  }

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!open || !trigger || !tip) return;
    const t = trigger.getBoundingClientRect();
    const { width, height } = tip.getBoundingClientRect();
    const above = t.top - height - GAP;
    const top = above >= EDGE ? above : t.bottom + GAP;
    const left = Math.min(
      Math.max(t.left + t.width / 2 - width / 2, EDGE),
      window.innerWidth - width - EDGE,
    );
    setPos({ top, left });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        className={className}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? "visible" : "hidden",
            }}
            className={clsx(
              "pointer-events-none fixed z-50 max-w-sm rounded-xl px-3 py-2 text-[13.5px] font-medium leading-snug text-pretty wrap-break-word shadow-lg",
              "bg-dark text-white dark:bg-white dark:text-dark",
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
