"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  MAX_BULK_MODERATION_IDS,
  type BulkModerationResult,
  type BulkSetCategories,
  type CreateStandaloneQuestionsBody,
  type ModerationListStatus,
} from "@buzrr/contract";
import { queryKeys } from "@/lib/modules/query-keys";
import { moderationApi, type ModerationDecision } from "./api";

export function useModerationQueueQuery(status: ModerationListStatus) {
  return useInfiniteQuery({
    queryKey: queryKeys.moderation.queue(status),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      moderationApi.queue(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useModerationCountsQuery() {
  return useQuery({
    queryKey: queryKeys.moderation.counts,
    queryFn: () => moderationApi.counts(),
  });
}

/** Every moderation view (all tabs + counts) is stale after any decision. */
function useInvalidateModeration() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.moderation.all });
}

export function useDecisionMutation() {
  const invalidate = useInvalidateModeration();
  return useMutation({
    mutationFn: (vars: { decision: ModerationDecision; id: string }) =>
      moderationApi.decide(vars.decision, vars.id),
    onSuccess: invalidate,
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Runs a bulk call per chunk of ids and adds the results up. */
async function inChunks(
  ids: string[],
  call: (ids: string[]) => Promise<BulkModerationResult>,
): Promise<BulkModerationResult> {
  const total: BulkModerationResult = { updated: 0, skipped: [] };
  for (const part of chunk(ids, MAX_BULK_MODERATION_IDS)) {
    const result = await call(part);
    total.updated += result.updated;
    total.skipped.push(...result.skipped);
  }
  return total;
}

export function useBulkDecisionMutation() {
  const invalidate = useInvalidateModeration();
  return useMutation({
    mutationFn: (vars: { decision: ModerationDecision; ids: string[] }) =>
      inChunks(vars.ids, (ids) => moderationApi.bulkDecide(vars.decision, ids)),
    // Settled, not success: a later chunk failing still leaves earlier ones applied.
    onSettled: invalidate,
  });
}

export function useSetQuestionCategoriesMutation() {
  const invalidate = useInvalidateModeration();
  return useMutation({
    mutationFn: (vars: { id: string; categoryIds: string[] }) =>
      moderationApi.setCategories(vars.id, vars.categoryIds),
    onSuccess: invalidate,
  });
}

export function useBulkSetCategoriesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: BulkSetCategories) =>
      inChunks(vars.ids, (ids) =>
        moderationApi.bulkSetCategories({ ...vars, ids }),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.moderation.all,
      });
      // Question counts per category change too.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.all,
      });
    },
  });
}

/** One bulk-upload chunk; the caller drives chunking to show progress. */
export function useCreateStandaloneQuestionsMutation() {
  return useMutation({
    mutationFn: (questions: CreateStandaloneQuestionsBody["questions"]) =>
      moderationApi.createStandalone(questions),
  });
}

export function useReportQuestionMutation() {
  return useMutation({
    mutationFn: moderationApi.report,
  });
}
