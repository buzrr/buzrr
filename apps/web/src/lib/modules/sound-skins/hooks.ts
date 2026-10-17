"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SoundSlot } from "@buzrr/contract";
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
  useSkinMutation((v: { id: string; name?: string; isGlobal?: boolean }) =>
    soundSkinsApi.update(v.id, { name: v.name, isGlobal: v.isGlobal }),
  );
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
