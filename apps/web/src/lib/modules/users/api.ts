import type { AxiosInstance } from "axios";
import { getAuthApiClient } from "@/lib/api/client";

export type UserStats = {
  quizzesCreated: number;
  gamesHosted: number;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  avgScore: number;
  avgCorrectCount: number;
};

export async function getMyStats(client: AxiosInstance) {
  const { data } = await client.get<UserStats>("/users/me/stats");
  return data;
}

export const usersApi = {
  myStats: () => getMyStats(getAuthApiClient()),
};
