"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { preferencesApi } from "./api";

const KEY = ["preferences"] as const;

export function usePreferencesQuery() {
  return useQuery({ queryKey: KEY, queryFn: preferencesApi.get });
}

function usePrefsMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}

export function useSharedAvatarsQuery() {
  return useQuery({
    queryKey: ["shared-avatars"],
    queryFn: preferencesApi.sharedAvatars,
  });
}

export const useUpdatePreferences = () =>
  usePrefsMutation(preferencesApi.update);
export const useSetDefaultLogo = () => usePrefsMutation(preferencesApi.setLogo);
export const useAddAvatar = () => usePrefsMutation(preferencesApi.addAvatar);
export const useRemoveAvatar = () =>
  usePrefsMutation(preferencesApi.removeAvatar);
