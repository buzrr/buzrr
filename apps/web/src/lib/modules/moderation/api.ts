import type { AxiosInstance } from "axios";
import type { Option, Question } from "@/types/db";
import { getAuthApiClient } from "@/lib/api/client";

export type ModerationQueueItem = Question & {
  options: Option[];
  /** Null for a standalone question (no quiz). */
  quiz: {
    id: string;
    title: string;
    user: { name: string | null; email: string };
  } | null;
  createdBy: { name: string | null; email: string } | null;
  categories: { id: string; name: string; hue: number }[];
};

export type ModerationQueuePage = {
  items: ModerationQueueItem[];
  nextCursor: string | null;
};

export async function listModerationQueue(
  client: AxiosInstance,
  cursor?: string,
) {
  const { data } = await client.get<ModerationQueuePage>(
    "/moderation/questions",
    { params: cursor ? { cursor } : undefined },
  );
  return data;
}

export async function approveQuestion(client: AxiosInstance, id: string) {
  await client.patch(`/moderation/questions/${id}/approve`);
}

export async function unapproveQuestion(client: AxiosInstance, id: string) {
  await client.patch(`/moderation/questions/${id}/unapprove`);
}

export async function setQuestionCategories(
  client: AxiosInstance,
  id: string,
  categoryIds: string[],
) {
  await client.patch(`/moderation/questions/${id}/categories`, {
    categoryIds,
  });
}

export async function reportQuestion(client: AxiosInstance, id: string) {
  await client.post(`/questions/${id}/report`);
}

export const moderationApi = {
  queue: (cursor?: string) => listModerationQueue(getAuthApiClient(), cursor),
  approve: (id: string) => approveQuestion(getAuthApiClient(), id),
  unapprove: (id: string) => unapproveQuestion(getAuthApiClient(), id),
  report: (id: string) => reportQuestion(getAuthApiClient(), id),
  setCategories: (id: string, categoryIds: string[]) =>
    setQuestionCategories(getAuthApiClient(), id, categoryIds),
};
