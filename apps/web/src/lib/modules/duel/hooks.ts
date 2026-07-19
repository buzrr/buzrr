"use client";

import { useQuery } from "@tanstack/react-query";
import { duelApi } from "./api";

export function useDuelProfileQuery(enabled = true) {
  return useQuery({
    queryKey: ["duel", "me"] as const,
    queryFn: () => duelApi.me(),
    enabled,
    staleTime: 10_000,
  });
}

export function useRecentDuelsQuery(limit?: number, enabled = true) {
  return useQuery({
    queryKey: ["duel", "recent", limit ?? 10] as const,
    queryFn: () => duelApi.recent(limit),
    enabled,
    staleTime: 30_000,
  });
}
