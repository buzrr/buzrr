"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/modules/query-keys";
import { aiApi } from "./api";

export function useSpacesQuery() {
  return useQuery({
    queryKey: queryKeys.ai.spaces,
    queryFn: () => aiApi.listSpaces(),
    staleTime: 30_000,
  });
}

export function useSpaceQuery(spaceId: string) {
  return useQuery({
    queryKey: queryKeys.ai.space(spaceId),
    queryFn: () => aiApi.getSpace(spaceId),
    enabled: Boolean(spaceId),
    staleTime: 30_000,
  });
}

/**
 * Ingestion progress.
 *
 * Polls only while something is actually in flight — the same approach as
 * `useDuelInviteQuery`. Once every document is `ready` or `failed` the interval
 * drops to `false` so an idle workspace makes no requests at all.
 */
export function useSpaceStatusQuery(spaceId: string) {
  return useQuery({
    queryKey: queryKeys.ai.spaceStatus(spaceId),
    queryFn: () => aiApi.getSpaceStatus(spaceId),
    enabled: Boolean(spaceId),
    refetchInterval: (query) =>
      query.state.data?.isProcessing ? 3_000 : false,
  });
}

export function useCreateSpaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: aiApi.createSpace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.spaces });
    },
  });
}

export function useDeleteSpaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: aiApi.deleteSpace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.spaces });
    },
  });
}

export function useUploadDocumentsMutation(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => aiApi.uploadDocuments(spaceId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.ai.spaceStatus(spaceId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.spaces });
    },
  });
}

export function useDeleteDocumentMutation(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: aiApi.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.ai.spaceStatus(spaceId),
      });
    },
  });
}

export function useRetryDocumentMutation(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: aiApi.retryDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.ai.spaceStatus(spaceId),
      });
    },
  });
}

export function useGenerateMutation(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      prompt: string;
      questionTypes?: string[];
      count?: number;
    }) => aiApi.generate(spaceId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.runs(spaceId) });
    },
  });
}

export function useRunsQuery(spaceId: string) {
  return useQuery({
    queryKey: queryKeys.ai.runs(spaceId),
    queryFn: () => aiApi.listRuns(spaceId),
    enabled: Boolean(spaceId),
    staleTime: 30_000,
  });
}

export function useRunQuery(runId: string | null) {
  return useQuery({
    queryKey: queryKeys.ai.run(runId ?? ""),
    queryFn: () => aiApi.getRun(runId!),
    enabled: Boolean(runId),
    staleTime: Infinity,
  });
}

export function useImportAsQuizMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: aiApi.importAsQuiz,
    onSuccess: () => {
      // The new quiz shows up in the existing quiz list.
      queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.all });
    },
  });
}
