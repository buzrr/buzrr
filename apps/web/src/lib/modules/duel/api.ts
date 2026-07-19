import type { AxiosInstance } from "axios";
import { getAuthApiClient } from "@/lib/api/client";
import type {
  GameResultEntry,
  GameResultWithEntries,
} from "@/lib/modules/game-sessions/api";

export type DuelProfile = {
  id: string;
  name: string | null;
  image: string | null;
  eloRating: number;
  duelsPlayed: number;
};

export type RecentDuel = GameResultEntry & {
  result: GameResultWithEntries;
};

export async function getDuelProfile(client: AxiosInstance) {
  const { data } = await client.get<DuelProfile>("/duel/me");
  return data;
}

export async function getRecentDuels(client: AxiosInstance, limit?: number) {
  const { data } = await client.get<RecentDuel[]>("/duel/recent", {
    params: limit ? { limit } : undefined,
  });
  return data;
}

export const duelApi = {
  me: () => getDuelProfile(getAuthApiClient()),
  recent: (limit?: number) => getRecentDuels(getAuthApiClient(), limit),
};
