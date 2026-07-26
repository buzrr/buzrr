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

export type DuelInvite = {
  code: string;
  host: { id: string; name: string; image: string | null; elo: number };
  expiresAt: number;
  status: "pending" | "claimed";
  /** True when the viewer created this challenge. */
  isHost: boolean;
  /** True when the viewer is the guest who claimed this challenge. */
  isClaimer: boolean;
  /** Whether the host is currently sitting on the waiting page. */
  hostOnline: boolean;
};

export type CreatedDuelInvite = { code: string; expiresAt: number };

export async function createDuelInvite(client: AxiosInstance) {
  const { data } = await client.post<CreatedDuelInvite>("/duel/invites");
  return data;
}

export async function getDuelInvite(client: AxiosInstance, code: string) {
  const { data } = await client.get<DuelInvite>(
    `/duel/invites/${encodeURIComponent(code)}`,
  );
  return data;
}

export async function cancelDuelInvite(client: AxiosInstance, code: string) {
  await client.delete(`/duel/invites/${encodeURIComponent(code)}`);
}

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
  createInvite: () => createDuelInvite(getAuthApiClient()),
  getInvite: (code: string) => getDuelInvite(getAuthApiClient(), code),
  cancelInvite: (code: string) => cancelDuelInvite(getAuthApiClient(), code),
};
