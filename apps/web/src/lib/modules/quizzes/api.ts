import type { AxiosInstance } from "axios";
import type { GameSession, Quiz } from "@/types/db";
import { authApi } from "@/lib/api/client";

export type QuizDetail = Quiz & {
  gameSessions: GameSession[];
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

export const quizzesApi = {
  list: () => listQuizzes(authApi),
  getById: (quizId: string) => getQuizById(authApi, quizId),
  create: (body: Parameters<typeof createQuiz>[1]) => createQuiz(authApi, body),
  createAi: (body: Parameters<typeof createAiQuiz>[1]) =>
    createAiQuiz(authApi, body),
  delete: (quizId: string) => deleteQuiz(authApi, quizId),
};
