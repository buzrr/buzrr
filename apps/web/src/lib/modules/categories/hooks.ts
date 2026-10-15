"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/modules/query-keys";
import { categoriesApi } from "./api";

/** Every category, for tagging questions (not only duel-playable ones). */
export function useCategoriesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => categoriesApi.list(),
    enabled,
    staleTime: 60_000,
  });
}
