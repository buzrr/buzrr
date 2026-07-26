"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
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

/**
 * Polls so the guest's Accept button re-enables when the host comes back, and
 * so a cancelled or expired challenge surfaces without a manual refresh.
 */
export function useDuelInviteQuery(code: string) {
  return useQuery({
    queryKey: ["duel", "invite", code] as const,
    queryFn: () => duelApi.getInvite(code),
    refetchInterval: 3_000,
    retry: false,
    staleTime: 0,
  });
}

export function useCreateDuelInviteMutation() {
  return useMutation({ mutationFn: () => duelApi.createInvite() });
}

export function useCancelDuelInviteMutation() {
  return useMutation({
    mutationFn: (code: string) => duelApi.cancelInvite(code),
  });
}
