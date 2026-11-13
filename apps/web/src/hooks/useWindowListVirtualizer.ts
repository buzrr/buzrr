"use client";

import {
  useCallback,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

/**
 * Virtualizes a list that scrolls with the page (admin pages scroll the
 * window, not an inner box). Attach `listRef` to the list's container: its
 * distance from the top of the document becomes the virtualizer's
 * `scrollMargin`, re-measured whenever the page above it changes size.
 *
 * Render each row absolutely at `top: row.start - scrollMargin` (not a
 * transform, which would trap a row's open menu under the next row) with
 * `ref={virtualizer.measureElement}` and `data-index`.
 */
export function useWindowListVirtualizer({
  count,
  estimateSize,
  gap = 0,
  overscan = 4,
}: {
  count: number;
  estimateSize: number;
  gap?: number;
  overscan?: number;
}) {
  const [list, listRef] = useState<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (!list) return;
    const measure = () =>
      setScrollMargin(list.getBoundingClientRect().top + window.scrollY);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [list]);

  const virtualizer = useWindowVirtualizer({
    count,
    estimateSize: () => estimateSize,
    gap,
    overscan,
    scrollMargin,
  });

  return { listRef, virtualizer, scrollMargin };
}

/** Live `matchMedia` result; `false` during SSR. */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
