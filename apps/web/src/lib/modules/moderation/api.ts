import type { AxiosInstance } from "axios";
import type {
  BulkModerationResult,
  BulkSetCategories,
  CreateStandaloneQuestionsBody,
  ModerationCounts,
  ModerationListStatus,
} from "@buzrr/contract";
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
  status: ModerationListStatus,
  cursor?: string,
) {
  const { data } = await client.get<ModerationQueuePage>(
    "/moderation/questions",
    { params: { status, ...(cursor ? { cursor } : {}) } },
  );
  return data;
}

export async function getModerationCounts(client: AxiosInstance) {
  const { data } = await client.get<ModerationCounts>(
    "/moderation/questions/counts",
  );
  return data;
}

/** Where a question can be moved: each is its own endpoint segment. */
export type ModerationDecision = "approve" | "unapprove" | "pending";

export async function decideQuestion(
  client: AxiosInstance,
  decision: ModerationDecision,
  id: string,
) {
  await client.patch(`/moderation/questions/${id}/${decision}`);
}

export async function bulkDecide(
  client: AxiosInstance,
  decision: ModerationDecision,
  ids: string[],
) {
  const { data } = await client.patch<BulkModerationResult>(
    `/moderation/questions/${decision}`,
    { ids },
  );
  return data;
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

export async function bulkSetQuestionCategories(
  client: AxiosInstance,
  body: BulkSetCategories,
) {
  const { data } = await client.patch<BulkModerationResult>(
    "/moderation/questions/categories",
    body,
  );
  return data;
}

/** Standalone duel-pool questions (admin-only), e.g. a bulk upload chunk. */
export async function createStandaloneQuestions(
  client: AxiosInstance,
  questions: CreateStandaloneQuestionsBody["questions"],
) {
  const { data } = await client.post<{ created: number; ids: string[] }>(
    "/questions",
    { questions },
  );
  return data;
}

export async function reportQuestion(client: AxiosInstance, id: string) {
  await client.post(`/questions/${id}/report`);
}

export const moderationApi = {
  queue: (status: ModerationListStatus, cursor?: string) =>
    listModerationQueue(getAuthApiClient(), status, cursor),
  counts: () => getModerationCounts(getAuthApiClient()),
  decide: (decision: ModerationDecision, id: string) =>
    decideQuestion(getAuthApiClient(), decision, id),
  bulkDecide: (decision: ModerationDecision, ids: string[]) =>
    bulkDecide(getAuthApiClient(), decision, ids),
  report: (id: string) => reportQuestion(getAuthApiClient(), id),
  setCategories: (id: string, categoryIds: string[]) =>
    setQuestionCategories(getAuthApiClient(), id, categoryIds),
  bulkSetCategories: (body: BulkSetCategories) =>
    bulkSetQuestionCategories(getAuthApiClient(), body),
  createStandalone: (questions: CreateStandaloneQuestionsBody["questions"]) =>
    createStandaloneQuestions(getAuthApiClient(), questions),
};
