"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/modules/query-keys";
import { gameSessionsApi } from "./api";

export function useCreateGameSessionMutation() {
  return useMutation({
    mutationFn: gameSessionsApi.create,
  });
}

export function useJoinRoomMutation() {
  return useMutation({
    mutationFn: gameSessionsApi.join,
  });
}

export function useSubmitAnswerMutation() {
  return useMutation({
    mutationFn: ({
      gameSessionId,
      ...body
    }: {
      gameSessionId: string;
      playerId: string;
      optionId: string;
      timeTaken: number;
    }) => gameSessionsApi.submitAnswer(gameSessionId, body),
  });
}

export function useLeaderboardQuery(gameCode: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.leaderboard(gameCode),
    queryFn: () => gameSessionsApi.leaderboard(gameCode),
    enabled: Boolean(gameCode) && enabled,
    staleTime: 0,
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

export function useLeaderboardByRoomQuery(roomId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.gameSessions.leaderboardRoom(roomId),
    queryFn: () => gameSessionsApi.leaderboardByRoom(roomId),
    enabled: Boolean(roomId) && enabled,
    staleTime: 15_000,
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
