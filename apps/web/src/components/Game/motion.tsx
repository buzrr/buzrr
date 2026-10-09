"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * A number that counts from `from` to `value` on mount, and from whatever it
 * shows to the new `value` whenever it changes. Jumps straight there under
 * reduced motion.
 */
export function AnimatedNumber({
  value,
  from = value,
  duration = 800,
  delay = 0,
  format = (n: number) => n.toLocaleString(),
}: {
  value: number;
  from?: number;
  duration?: number;
  /** ms to hold before counting (e.g. to stay in step with a staggered bar). */
  delay?: number;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(from);
  const shownRef = useRef(from);

  useEffect(() => {
    const start = shownRef.current;
    if (start === value || prefersReducedMotion()) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    let raf = 0;
    let t0 = 0;
    const tick = (now: number) => {
      t0 ||= now;
      const t = Math.min(1, (now - t0) / duration);
      const next = Math.round(start + (value - start) * easeOutCubic(t));
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, duration, delay]);

  return <>{format(shown)}</>;
}

/** False on the first paint, true right after — for "grow from zero" CSS transitions. */
export function useEntered(): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    // Two frames so the zero state is actually painted before the change.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  return entered;
}

/**
 * FLIP reorder animation: children of `container` marked `data-flip-id` glide
 * from their previous position to their new one whenever `orderKey` changes.
 */
export function useFlipReorder(
  container: RefObject<HTMLElement | null>,
  orderKey: string,
  duration = 650,
) {
  const positions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const reduced = prefersReducedMotion();
    const next = new Map<string, number>();
    root.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
      const id = el.dataset.flipId!;
      const top = el.offsetTop;
      next.set(id, top);
      const prev = positions.current.get(id);
      if (!reduced && prev !== undefined && prev !== top) {
        el.animate(
          [
            { transform: `translateY(${prev - top}px)` },
            { transform: "translateY(0)" },
          ],
          { duration, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        );
      }
    });
    positions.current = next;
  }, [container, orderKey, duration]);
}
