"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/modules/query-keys";
import { usersApi } from "./api";

export function useMyStatsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.myStats,
    queryFn: () => usersApi.myStats(),
    enabled,
    staleTime: 30_000,
  });
}
