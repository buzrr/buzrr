import type { AxiosInstance } from "axios";
import type { GameLeaderboard, Player } from "@/types/db";
import { authApi, publicApi } from "@/lib/api/client";

export async function createGameSession(
  client: AxiosInstance,
  body: { quizId: string },
) {
  const { data } = await client.post<{ id: string }>("/game-sessions", body);
  return data;
}

export async function joinRoom(
  client: AxiosInstance,
  body: { gameCode: string; playerId: string },
) {
  const { data } = await client.post<{ roomId: string; playerId: string }>(
    "/game-sessions/join",
    body,
  );
  return data;
}

export async function submitAnswer(
  client: AxiosInstance,
  gameSessionId: string,
  body: { playerId: string; optionId: string; timeTaken: number },
) {
  await client.post(`/game-sessions/${gameSessionId}/answers`, body);
}

export type LeaderboardRow = GameLeaderboard & { Player: Player };

export async function getLeaderboard(
  client: AxiosInstance,
  gameCode: string,
) {
  const { data } = await client.get<LeaderboardRow[]>(
    `/game-sessions/by-code/${encodeURIComponent(gameCode)}/leaderboard`,
  );
  return data;
}

export const gameSessionsApi = {
  create: (body: Parameters<typeof createGameSession>[1]) =>
    createGameSession(authApi, body),
  join: (body: Parameters<typeof joinRoom>[1]) => joinRoom(publicApi, body),
  submitAnswer: (
    gameSessionId: string,
    body: Parameters<typeof submitAnswer>[2],
  ) => submitAnswer(publicApi, gameSessionId, body),
  leaderboard: (gameCode: string) => getLeaderboard(authApi, gameCode),
};
