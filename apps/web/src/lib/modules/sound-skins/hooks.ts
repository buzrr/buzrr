"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SoundSkinOptions, SoundSlot } from "@buzrr/contract";
import { soundSkinsApi } from "./api";

const KEY = ["sound-skins"] as const;

export function useSoundSkinsQuery() {
  return useQuery({ queryKey: KEY, queryFn: () => soundSkinsApi.list() });
}

function useSkinMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export const useCreateSoundSkin = () =>
  useSkinMutation((name: string) => soundSkinsApi.create(name));
export const useUpdateSoundSkin = () =>
  useSkinMutation(
    (v: {
      id: string;
      name?: string;
      isGlobal?: boolean;
      options?: SoundSkinOptions;
    }) =>
      soundSkinsApi.update(v.id, {
        name: v.name,
        isGlobal: v.isGlobal,
        options: v.options,
      }),
  );

const BUILTIN_KEY = ["sound-skins", "builtin-options"] as const;

export function useBuiltinOptionsQuery() {
  return useQuery({
    queryKey: BUILTIN_KEY,
    queryFn: () => soundSkinsApi.builtinOptions(),
  });
}

export function useSetBuiltinOptions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { skinId: string; options: SoundSkinOptions }) =>
      soundSkinsApi.setBuiltinOptions(v.skinId, v.options),
    onSuccess: (data) => qc.setQueryData(BUILTIN_KEY, data),
  });
}
export const useSetSoundSlot = () =>
  useSkinMutation((v: { id: string; slot: SoundSlot; file: File }) =>
    soundSkinsApi.setSlot(v.id, v.slot, v.file),
  );
export const useClearSoundSlot = () =>
  useSkinMutation((v: { id: string; slot: SoundSlot }) =>
    soundSkinsApi.clearSlot(v.id, v.slot),
  );
export const useDeleteSoundSkin = () =>
  useSkinMutation((id: string) => soundSkinsApi.remove(id));
