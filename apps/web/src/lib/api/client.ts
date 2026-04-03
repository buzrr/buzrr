import axios from "axios";
import { fetchApiAccessToken } from "./get-access-token";

export function getApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (!raw) {
    throw new Error(
      "Set NEXT_PUBLIC_API_URL (or NEXT_PUBLIC_SOCKET_URL) to your Nest server origin (no /api suffix).",
    );
  }
  return `${raw.replace(/\/$/, "")}/api`;
}

export function createPublicApiClient() {
  return axios.create({
    baseURL: getApiBaseUrl(),
  });
}

export function createAuthApiClient() {
  const client = axios.create({
    baseURL: getApiBaseUrl(),
  });

  client.interceptors.request.use(async (config) => {
    const token = await fetchApiAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return client;
}

export const publicApi = createPublicApiClient();
export const authApi = createAuthApiClient();

/** Bearer token from `localStorage` (`playerToken`) for player-scoped routes (e.g. join room). */
export function createPlayerAuthedApiClient() {
  const client = axios.create({
    baseURL: getApiBaseUrl(),
  });
  client.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("playerToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });
  return client;
}
