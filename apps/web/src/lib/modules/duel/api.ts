import type { AxiosInstance } from "axios";
import { getAuthApiClient } from "@/lib/api/client";

export type DuelProfile = {
  id: string;
  name: string | null;
  image: string | null;
  eloRating: number;
  duelsPlayed: number;
};

export async function getDuelProfile(client: AxiosInstance) {
  const { data } = await client.get<DuelProfile>("/duel/me");
  return data;
}

export const duelApi = {
  me: () => getDuelProfile(getAuthApiClient()),
};
