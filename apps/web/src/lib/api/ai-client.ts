import axios from "axios";
import { fetchApiAccessToken } from "./get-access-token";

/**
 * Axios instance for the Buzrr-AI service (`apps/ai`).
 *
 * Separate origin from the Nest API, but the **same** access token: the AI
 * service verifies the identical HS256 `BETTER_AUTH_SECRET` JWT that the Nest
 * server does, so this reuses `fetchApiAccessToken` verbatim rather than
 * introducing a second credential.
 */
export function getAiApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_AI_API_URL?.trim();
  if (!raw) {
    throw new Error(
      "Set NEXT_PUBLIC_AI_API_URL to your Buzrr-AI service origin (no /api suffix).",
    );
  }
  return `${raw.replace(/\/$/, "")}/api/ai`;
}

/** Whether the AI section should be shown at all. Unset ⇒ feature hidden. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_AI_API_URL?.trim());
}

function createAiApiClient() {
  const client = axios.create({ baseURL: getAiApiBaseUrl() });

  client.interceptors.request.use(async (config) => {
    const token = await fetchApiAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return client;
}

let aiApiInstance: ReturnType<typeof createAiApiClient> | null = null;

export function getAiApiClient() {
  if (!aiApiInstance) {
    aiApiInstance = createAiApiClient();
  }
  return aiApiInstance;
}
