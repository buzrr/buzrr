"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpsertCategory } from "@buzrr/contract";
import { queryKeys } from "@/lib/modules/query-keys";
import { categoriesApi } from "./api";

/** Every category, for tagging questions (not only duel-playable ones). */
export function useCategoriesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => categoriesApi.list(),
    enabled,
    staleTime: 60_000,
  });
}

/** Category edits show up on question rows too (name, swatch, untagging). */
function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.moderation.all });
  };
}

export function useCreateCategoryMutation() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (body: UpsertCategory) => categoriesApi.create(body),
    onSuccess: invalidate,
  });
}

export function useUpdateCategoryMutation() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpsertCategory }) =>
      categoriesApi.update(vars.id, vars.body),
    onSuccess: invalidate,
  });
}

export function useDeleteCategoryMutation() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.remove(id),
    onSuccess: invalidate,
  });
}
