"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/modules/query-keys";
import { gameSessionsApi } from "./api";

export function useCreateGameSessionMutation() {
  return useMutation({
    mutationFn: gameSessionsApi.create,
  });
}

export function useJoinRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: gameSessionsApi.join,
    onSuccess: (res) => {
      // Clear any stale play snapshot (e.g. gameId: null cached after leaving a
      // previous room) so the play page fetches fresh data instead of reading
      // the old snapshot and redirecting straight back to the join screen.
      queryClient.resetQueries({
        queryKey: queryKeys.gameSessions.playerPlay(res.playerId),
      });
    },
  });
}

export function useEndRoomMutation() {
  return useMutation({
    mutationFn: gameSessionsApi.end,
  });
}

export function useRemoveRoomPlayerMutation() {
  return useMutation({
    mutationFn: gameSessionsApi.removePlayer,
  });
}

export function useBanRoomPlayerMutation() {
  return useMutation({
    mutationFn: gameSessionsApi.banPlayer,
  });
}

export function useAdminLobbyQuery(roomId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.gameSessions.lobby(roomId),
    queryFn: () => gameSessionsApi.adminLobby(roomId),
    enabled: Boolean(roomId) && enabled,
    staleTime: 5_000,
  });
}

export function useHistoryQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.gameSessions.history,
    queryFn: () => gameSessionsApi.history(),
    enabled,
    staleTime: 15_000,
  });
}

export function useResultQuery(resultId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.gameSessions.result(resultId),
    queryFn: () => gameSessionsApi.result(resultId),
    enabled: Boolean(resultId) && enabled,
    // Results are immutable once written.
    staleTime: Infinity,
  });
}

export function usePlayerPlayQuery(playerId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.gameSessions.playerPlay(playerId),
    queryFn: () => gameSessionsApi.playerPlay(playerId),
    enabled: Boolean(playerId) && enabled,
    staleTime: 5_000,
  });
}
