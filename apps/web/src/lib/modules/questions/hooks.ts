"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/modules/query-keys";
import { questionsApi } from "./api";

export function useQuestionsQuery(quizId: string) {
  return useQuery({
    queryKey: queryKeys.questions(quizId),
    queryFn: () => questionsApi.list(quizId),
    enabled: Boolean(quizId),
    staleTime: 30_000,
  });
}

export function useUpsertQuestionMutation(quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      questionsApi.upsertMultipart(quizId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions(quizId) });
    },
  });
}

export function useReorderQuestionsMutation(quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: questionsApi.reorder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions(quizId) });
    },
  });
}

export function useDeleteQuestionMutation(quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: questionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions(quizId) });
    },
  });
}
