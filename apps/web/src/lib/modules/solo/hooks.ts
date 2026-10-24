"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/modules/query-keys";
import { soloApi } from "./api";

export function useSoloTestsQuery(quizId: string) {
  return useQuery({
    queryKey: queryKeys.solo.tests(quizId),
    queryFn: () => soloApi.list(quizId),
    staleTime: 15_000,
  });
}

export function useSoloReportQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.solo.report(id ?? ""),
    queryFn: () => soloApi.report(id!),
    enabled: id !== null,
    // Players may still be playing: refresh while it is on screen.
    refetchInterval: 20_000,
  });
}

export function useCreateSoloTestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: soloApi.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.solo.all }),
  });
}

export function useUpdateSoloTestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: soloApi.update,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.solo.all }),
  });
}

export function useDeleteSoloTestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: soloApi.remove,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.solo.all }),
  });
}
