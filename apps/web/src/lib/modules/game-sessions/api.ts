import type { AxiosInstance } from "axios";
import type {
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

export type GameResultEntry = {
  id: string;
  gameResultId: string;
  playerName: string;
  profilePic: string | null;
  userId: string | null;
  score: number;
  rank: number;
  correctCount: number;
  eloBefore: number | null;
  eloAfter: number | null;
};

export type GameResult = {
  id: string;
  gameCode: string;
  mode: "classic" | "duel";
  quizId: string | null;
  quizTitle: string;
  hostId: string | null;
  playerCount: number;
  questionCount: number;
  startedAt: string;
  endedAt: string;
};

export type GameResultWithEntries = GameResult & { entries: GameResultEntry[] };

export type AdminLobbyPayload = {
  room: GameSession;
  players: Player[];
  quiz: Quiz & { questions: (Question & { options: Option[] })[] };
  /** Host's room-size cap (beta / free-tier limit). */
  maxPlayers: number;
};

export async function getAdminLobby(client: AxiosInstance, roomId: string) {
  const { data } = await client.get<AdminLobbyPayload>(
    `/game-sessions/${encodeURIComponent(roomId)}/lobby`,
  );
  return data;
}

export async function endRoom(client: AxiosInstance, roomId: string) {
  const { data } = await client.post<{ ended: boolean }>(
    `/game-sessions/${encodeURIComponent(roomId)}/end`,
  );
  return data;
}

export async function removeRoomPlayer(
  client: AxiosInstance,
  roomId: string,
  playerId: string,
) {
  const { data } = await client.delete<{ removed: boolean }>(
    `/game-sessions/${encodeURIComponent(roomId)}/players/${encodeURIComponent(playerId)}`,
  );
  return data;
}

export async function banRoomPlayer(
  client: AxiosInstance,
  roomId: string,
  playerId: string,
) {
  const { data } = await client.post<{ banned: boolean }>(
    `/game-sessions/${encodeURIComponent(roomId)}/players/${encodeURIComponent(playerId)}/ban`,
  );
  return data;
}

export async function getHistory(client: AxiosInstance) {
  const { data } = await client.get<
    (GameResult & { _count: { entries: number } })[]
  >("/game-sessions/history");
  return data;
}

export async function getResult(client: AxiosInstance, resultId: string) {
  const { data } = await client.get<GameResultWithEntries>(
    `/game-sessions/results/${encodeURIComponent(resultId)}`,
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

export async function getPlayerPlay(client: AxiosInstance, playerId: string) {
  const { data } = await client.get<PlayerPlayPayload>(
    `/game-sessions/player-play/${encodeURIComponent(playerId)}`,
  );
  return data;
}

export const gameSessionsApi = {
  create: (body: Parameters<typeof createGameSession>[1]) =>
    createGameSession(getAuthApiClient(), body),
  join: (body: Parameters<typeof joinRoom>[1]) =>
    joinRoom(createPlayerAuthedApiClient(), body),
  adminLobby: (roomId: string) => getAdminLobby(getAuthApiClient(), roomId),
  end: (roomId: string) => endRoom(getAuthApiClient(), roomId),
  removePlayer: (args: { roomId: string; playerId: string }) =>
    removeRoomPlayer(getAuthApiClient(), args.roomId, args.playerId),
  banPlayer: (args: { roomId: string; playerId: string }) =>
    banRoomPlayer(getAuthApiClient(), args.roomId, args.playerId),
  history: () => getHistory(getAuthApiClient()),
  result: (resultId: string) => getResult(getAuthApiClient(), resultId),
  playerPlay: (playerId: string) =>
    getPlayerPlay(getPublicApiClient(), playerId),
};
