"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/modules/query-keys";
import { moderationApi } from "./api";

export function useModerationQueueQuery() {
  return useInfiniteQuery({
    queryKey: queryKeys.moderation.queue,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      moderationApi.queue(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useApproveQuestionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: moderationApi.approve,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.moderation.queue });
    },
  });
}

export function useUnapproveQuestionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: moderationApi.unapprove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.moderation.queue });
    },
  });
}

export function useReportQuestionMutation() {
  return useMutation({
    mutationFn: moderationApi.report,
  });
}
