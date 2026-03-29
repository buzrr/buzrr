"use client";

import { useMutation } from "@tanstack/react-query";
import { quizzesApi } from "./api";

export function useCreateQuizMutation() {
  return useMutation({
    mutationFn: quizzesApi.create,
  });
}

export function useCreateAiQuizMutation() {
  return useMutation({
    mutationFn: quizzesApi.createAi,
  });
}

export function useDeleteQuizMutation() {
  return useMutation({
    mutationFn: quizzesApi.delete,
  });
}
