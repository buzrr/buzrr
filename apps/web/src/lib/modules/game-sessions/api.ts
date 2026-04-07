import type { AxiosInstance } from "axios";
import type {
  GameLeaderboard,
  GameSession,
  Option,
  Player,
  Question,
  Quiz,
  User,
} from "@/types/db";
import {
  createPlayerAuthedApiClient,
  getAuthApiClient,
  getPublicApiClient,
} from "@/lib/api/client";

export async function createGameSession(
  client: AxiosInstance,
  body: { quizId: string },
) {
  const { data } = await client.post<{ id: string }>("/game-sessions", body);
  return data;
}

export async function joinRoom(
  client: AxiosInstance,
  body: { gameCode: string },
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

export type AdminLobbyPayload = {
  room: GameSession;
  players: Player[];
  quiz: Quiz & { questions: (Question & { options: Option[] })[] };
};

export async function getAdminLobby(
  client: AxiosInstance,
  roomId: string,
) {
  const { data } = await client.get<AdminLobbyPayload>(
    `/game-sessions/${encodeURIComponent(roomId)}/lobby`,
  );
  return data;
}

export async function getLeaderboardByRoom(
  client: AxiosInstance,
  roomId: string,
) {
  const { data } = await client.get<LeaderboardRow[]>(
    `/game-sessions/${encodeURIComponent(roomId)}/leaderboard`,
  );
  return data;
}

export type PlayerPlayGame = GameSession & {
  quiz: Quiz & {
    questions: (Question & {
      options: Pick<Option, "id" | "title">[];
    })[];
  };
  creator: Pick<User, "name" | "image">;
};

export type PlayerPlayPayload = {
  player: Player;
  game: PlayerPlayGame | null;
};

export async function getPlayerPlay(
  client: AxiosInstance,
  playerId: string,
) {
  const { data } = await client.get<PlayerPlayPayload>(
    `/game-sessions/player-play/${encodeURIComponent(playerId)}`,
  );
  return data;
}

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
    createGameSession(getAuthApiClient(), body),
  join: (body: Parameters<typeof joinRoom>[1]) =>
    joinRoom(createPlayerAuthedApiClient(), body),
  submitAnswer: (
    gameSessionId: string,
    body: Parameters<typeof submitAnswer>[2],
  ) => submitAnswer(getPublicApiClient(), gameSessionId, body),
  leaderboard: (gameCode: string) =>
    getLeaderboard(getAuthApiClient(), gameCode),
  adminLobby: (roomId: string) => getAdminLobby(getAuthApiClient(), roomId),
  leaderboardByRoom: (roomId: string) =>
    getLeaderboardByRoom(getAuthApiClient(), roomId),
  playerPlay: (playerId: string) => getPlayerPlay(getPublicApiClient(), playerId),
};
