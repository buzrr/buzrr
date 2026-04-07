import type { AxiosInstance } from "axios";
import type { Option, Question } from "@/types/db";
import { getAuthApiClient } from "@/lib/api/client";

export type QuestionWithOptions = Question & { options: Option[] };

export async function listQuestions(client: AxiosInstance, quizId: string) {
  const { data } = await client.get<{
    status: number;
    questions: QuestionWithOptions[];
  }>(`/quizzes/${quizId}/questions`);
  return data;
}

export async function upsertQuestionMultipart(
  client: AxiosInstance,
  quizId: string,
  formData: FormData,
) {
  await client.post(`/quizzes/${quizId}/questions`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function reorderQuestions(
  client: AxiosInstance,
  body: { dragQuesId: string; dropQuesId: string },
) {
  await client.patch("/questions/reorder", body);
}

export async function deleteQuestion(client: AxiosInstance, questionId: string) {
  await client.delete(`/questions/${questionId}`);
}

export const questionsApi = {
  list: (quizId: string) => listQuestions(getAuthApiClient(), quizId),
  upsertMultipart: (quizId: string, formData: FormData) =>
    upsertQuestionMultipart(getAuthApiClient(), quizId, formData),
  reorder: (body: Parameters<typeof reorderQuestions>[1]) =>
    reorderQuestions(getAuthApiClient(), body),
  delete: (questionId: string) => deleteQuestion(getAuthApiClient(), questionId),
};
