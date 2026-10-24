import type { QuizSettings } from "@buzrr/contract";
import type { AxiosInstance } from "axios";
import type { QuestionType } from "@buzrr/contract";
import type { GameSession, Quiz } from "@/types/db";
import type { GameResult } from "@/lib/modules/game-sessions/api";
import { getAuthApiClient } from "@/lib/api/client";

export type QuizDetail = Quiz & {
  gameSessions: GameSession[];
  gameResults: GameResult[];
  _count: { questions: number };
};

export type QuizListItem = Quiz & {
  _count?: { questions: number; gameResults: number };
};

export async function listQuizzes(client: AxiosInstance) {
  const { data } = await client.get<QuizListItem[]>("/quizzes");
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
    /** 1 (easy) to 5 (hard). */
    difficulty?: number;
    /** How many of each type: 0 none, 1 few, 2 medium, 3 many. */
    multipleChoice?: number;
    trueFalse?: number;
    typeAnswer?: number;
    /** Language to write the quiz in (the UI language). */
    language?: string;
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
  body: {
    title?: string;
    description?: string;
    isPublic?: boolean;
    settings?: QuizSettings;
  },
) {
  const { data } = await client.patch<Quiz>(`/quizzes/${quizId}`, body);
  return data;
}

export async function importQuiz(
  client: AxiosInstance,
  body: {
    title: string;
    description?: string;
    questions: {
      title: string;
      type?: QuestionType;
      timeOut?: number;
      options: { title: string; isCorrect: boolean }[];
    }[];
  },
) {
  const { data } = await client.post<{ quizId: string }>(
    "/quizzes/import",
    body,
  );
  return data;
}

export const quizzesApi = {
  list: () => listQuizzes(getAuthApiClient()),
  getById: (quizId: string) => getQuizById(getAuthApiClient(), quizId),
  create: (body: Parameters<typeof createQuiz>[1]) =>
    createQuiz(getAuthApiClient(), body),
  createAi: (body: Parameters<typeof createAiQuiz>[1]) =>
    createAiQuiz(getAuthApiClient(), body),
  import: (body: Parameters<typeof importQuiz>[1]) =>
    importQuiz(getAuthApiClient(), body),
  update: (quizId: string, body: Parameters<typeof updateQuiz>[2]) =>
    updateQuiz(getAuthApiClient(), quizId, body),
  delete: (quizId: string) => deleteQuiz(getAuthApiClient(), quizId),
  /** Whether the server has an AI model configured for quiz generation. */
  aiStatus: async () =>
    (await getAuthApiClient().get<{ available: boolean }>("/quizzes/ai/status"))
      .data,
  /** A copy with all questions; returns the new quiz's id. */
  duplicate: async (quizId: string) =>
    (
      await getAuthApiClient().post<{ quizId: string }>(
        `/quizzes/${quizId}/duplicate`,
      )
    ).data,
  /** Deletes one past run (`resultId`) or every past run of the quiz. */
  deleteResults: async (target: { resultId: string } | { quizId: string }) => {
    await getAuthApiClient().delete(
      "resultId" in target
        ? `/game-sessions/results/${target.resultId}`
        : `/game-sessions/results/by-quiz/${target.quizId}`,
    );
  },
};
