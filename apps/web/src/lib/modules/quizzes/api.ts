import type { AxiosInstance } from "axios";
import type { GameSession, Quiz } from "@/types/db";
import type { GameResult } from "@/lib/modules/game-sessions/api";
import { getAuthApiClient } from "@/lib/api/client";

export type QuizDetail = Quiz & {
  gameSessions: GameSession[];
  gameResults: GameResult[];
  _count: { questions: number };
};

export async function listQuizzes(client: AxiosInstance) {
  const { data } = await client.get<Quiz[]>("/quizzes");
  return data;
}

export async function getQuizById(client: AxiosInstance, quizId: string) {
  const { data } = await client.get<QuizDetail>(`/quizzes/${quizId}`);
  return data;
}

export async function createQuiz(
  client: AxiosInstance,
  body: { title: string; description?: string },
) {
  const { data } = await client.post<{ quizId: string }>("/quizzes", body);
  return data;
}

export async function createAiQuiz(
  client: AxiosInstance,
  body: {
    title: string;
    description: string;
    questions: number;
    time: number;
  },
) {
  const { data } = await client.post<{ msg: string; quizId: string }>(
    "/quizzes/ai",
    body,
  );
  return data;
}

export async function deleteQuiz(client: AxiosInstance, quizId: string) {
  await client.delete(`/quizzes/${quizId}`);
}

export async function updateQuiz(
  client: AxiosInstance,
  quizId: string,
  body: { title?: string; description?: string; isPublic?: boolean },
) {
  const { data } = await client.patch<Quiz>(`/quizzes/${quizId}`, body);
  return data;
}

export const quizzesApi = {
  list: () => listQuizzes(getAuthApiClient()),
  getById: (quizId: string) => getQuizById(getAuthApiClient(), quizId),
  create: (body: Parameters<typeof createQuiz>[1]) =>
    createQuiz(getAuthApiClient(), body),
  createAi: (body: Parameters<typeof createAiQuiz>[1]) =>
    createAiQuiz(getAuthApiClient(), body),
  update: (quizId: string, body: Parameters<typeof updateQuiz>[2]) =>
    updateQuiz(getAuthApiClient(), quizId, body),
  delete: (quizId: string) => deleteQuiz(getAuthApiClient(), quizId),
};
