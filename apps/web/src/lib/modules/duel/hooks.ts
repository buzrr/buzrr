"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  return useMutation({
    mutationFn: (categoryId: string | null) => duelApi.createInvite(categoryId),
  });
}

export function useDuelCategoriesQuery(enabled = true) {
  return useQuery({
    queryKey: ["duel", "categories"] as const,
    queryFn: () => duelApi.categories(),
    enabled,
    staleTime: 60_000,
  });
}

/** Days with a counted duel in one month (`YYYY-MM`) of the streak calendar. */
export function useStreakMonthQuery(month: string, enabled = true) {
  return useQuery({
    queryKey: ["duel", "streak", month] as const,
    queryFn: () => duelApi.streakMonth(month),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Keeps the server's idea of "today" (daily streak) in the browser's zone:
 * sends the IANA zone once whenever it differs from the stored one.
 */
export function useSyncDuelTimeZone(stored: string | null | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (stored === undefined) return; // profile not loaded yet
    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!zone || zone === stored) return;
    duelApi
      .setTimeZone(zone)
      .then(() => queryClient.invalidateQueries({ queryKey: ["duel", "me"] }))
      .catch(() => {
        // Non-fatal: the streak falls back to the stored zone (or UTC).
      });
  }, [stored, queryClient]);
}

export function useCancelDuelInviteMutation() {
  return useMutation({
    mutationFn: (code: string) => duelApi.cancelInvite(code),
  });
}
