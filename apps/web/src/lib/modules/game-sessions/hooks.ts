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
