import type { AxiosInstance } from "axios";
import type { Player } from "@/types/db";
import { getPublicApiClient } from "@/lib/api/client";

export async function getPlayer(client: AxiosInstance, playerId: string) {
  const { data } = await client.get<Player>(`/players/${playerId}`);
  return data;
}

export async function clearPlayerGame(client: AxiosInstance, playerId: string) {
  const { data } = await client.patch<Player>(
    `/players/${playerId}/clear-game`,
  );
  return data;
}

export async function createPlayer(
  client: AxiosInstance,
  body: { username: string; profile: string },
) {
  const { data } = await client.post<{
    playerId: string;
    accessToken: string;
  }>("/players", body);
  return data;
}

export async function updatePlayerName(
  client: AxiosInstance,
  body: { playerId: string; username: string },
) {
  const { data } = await client.patch<{ playerId: string; name: string }>(
    "/players/name",
    body,
  );
  return data;
}

export const playersApi = {
  getById: (playerId: string) => getPlayer(getPublicApiClient(), playerId),
  clearGame: (playerId: string) =>
    clearPlayerGame(getPublicApiClient(), playerId),
  create: (body: Parameters<typeof createPlayer>[1]) =>
    createPlayer(getPublicApiClient(), body),
  updateName: (body: Parameters<typeof updatePlayerName>[1]) =>
    updatePlayerName(getPublicApiClient(), body),
};
