import type { AxiosInstance } from "axios";
import { publicApi } from "@/lib/api/client";

export async function createPlayer(
  client: AxiosInstance,
  body: { username: string; profile: string },
) {
  const { data } = await client.post<{ playerId: string }>("/players", body);
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
  create: (body: Parameters<typeof createPlayer>[1]) =>
    createPlayer(publicApi, body),
  updateName: (body: Parameters<typeof updatePlayerName>[1]) =>
    updatePlayerName(publicApi, body),
};
