"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/modules/query-keys";
import { playersApi } from "./api";

export function usePlayerQuery(playerId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.players.detail(playerId),
    queryFn: () => playersApi.getById(playerId),
    enabled: Boolean(playerId) && enabled,
    staleTime: 15_000,
  });
}

export function useClearPlayerGameMutation(playerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => playersApi.clearGame(playerId),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.players.detail(playerId), updated);
      queryClient.invalidateQueries({
        queryKey: queryKeys.players.detail(playerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.gameSessions.playerPlay(playerId),
      });
    },
  });
}

export function useCreatePlayerMutation() {
  return useMutation({
    mutationFn: playersApi.create,
  });
}

export function useUpdatePlayerNameMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: playersApi.updateName,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.players.detail(variables.playerId),
      });
    },
  });
}
