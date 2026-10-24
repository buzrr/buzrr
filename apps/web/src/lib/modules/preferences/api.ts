import type { UserPreferences } from "@buzrr/contract";
import { getAuthApiClient } from "@/lib/api/client";

/** The signed-in user's defaults. */
export const preferencesApi = {
  get: async () =>
    (await getAuthApiClient().get<UserPreferences>("/users/me/preferences"))
      .data,
  update: async (patch: { defaultSoundSkin?: string }) =>
    (
      await getAuthApiClient().patch<UserPreferences>(
        "/users/me/preferences",
        patch,
      )
    ).data,
};
