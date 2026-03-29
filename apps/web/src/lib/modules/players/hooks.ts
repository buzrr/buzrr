"use client";

import { useMutation } from "@tanstack/react-query";
import { playersApi } from "./api";

export function useCreatePlayerMutation() {
  return useMutation({
    mutationFn: playersApi.create,
  });
}

export function useUpdatePlayerNameMutation() {
  return useMutation({
    mutationFn: playersApi.updateName,
  });
}
