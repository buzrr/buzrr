"use client";

import { useEffect, useRef } from "react";

/**
 * Returns a ref for a sentinel element placed after a list; when it scrolls
 * near the viewport, `loadMore` runs (once per page, while `hasMore`).
 */
export function useLoadMoreOnScroll({
  hasMore,
  loading,
  loadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  loadMore: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    const node = ref.current;
    if (!node || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreRef.current();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  return ref;
}
