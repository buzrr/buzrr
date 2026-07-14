import type { AxiosInstance } from "axios";
import type { Option, Question } from "@/types/db";
import { getAuthApiClient } from "@/lib/api/client";

export type ModerationQueueItem = Question & {
  options: Option[];
  quiz: {
    id: string;
    title: string;
    user: { name: string | null; email: string };
  };
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

export async function reportQuestion(client: AxiosInstance, id: string) {
  await client.post(`/questions/${id}/report`);
}

export const moderationApi = {
  queue: (cursor?: string) => listModerationQueue(getAuthApiClient(), cursor),
  approve: (id: string) => approveQuestion(getAuthApiClient(), id),
  unapprove: (id: string) => unapproveQuestion(getAuthApiClient(), id),
  report: (id: string) => reportQuestion(getAuthApiClient(), id),
};
