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
