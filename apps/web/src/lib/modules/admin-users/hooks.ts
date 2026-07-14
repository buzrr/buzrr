"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/modules/query-keys";
import { adminUsersApi } from "./api";

export function useAdminsQuery(search: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.admins.list(search),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      adminUsersApi.list({ search, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

function useSetRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "admin" | "user" }) =>
      adminUsersApi.setRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admins.lists });
    },
  });
}

export function usePromoteUserMutation() {
  const mutation = useSetRoleMutation();
  return {
    ...mutation,
    mutate: (userId: string, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ userId, role: "admin" }, options),
  };
}

export function useDemoteUserMutation() {
  const mutation = useSetRoleMutation();
  return {
    ...mutation,
    mutate: (userId: string, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ userId, role: "user" }, options),
  };
}
