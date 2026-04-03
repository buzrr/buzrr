"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/modules/query-keys";
import { quizzesApi } from "./api";

export function useQuizzesQuery() {
  return useQuery({
    queryKey: queryKeys.quizzes.all,
    queryFn: () => quizzesApi.list(),
    staleTime: 30_000,
  });
}

export function useQuizDetailQuery(quizId: string) {
  return useQuery({
    queryKey: queryKeys.quizzes.detail(quizId),
    queryFn: () => quizzesApi.getById(quizId),
    enabled: Boolean(quizId),
    staleTime: 30_000,
  });
}

export function useCreateQuizMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: quizzesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.all });
    },
  });
}

export function useCreateAiQuizMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: quizzesApi.createAi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.all });
    },
  });
}

export function useDeleteQuizMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: quizzesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.all });
    },
  });
}
