import type { UserPreferences } from "@buzrr/contract";
import { getAuthApiClient } from "@/lib/api/client";

const upload = async (path: string, file: File | null) => {
  const fd = new FormData();
  if (file) fd.append("file", file);
  return (await getAuthApiClient().post<UserPreferences>(path, fd)).data;
};

/** The signed-in user's defaults and own avatar pictures. */
export const preferencesApi = {
  get: async () =>
    (await getAuthApiClient().get<UserPreferences>("/users/me/preferences"))
      .data,
  update: async (patch: {
    defaultSoundSkin?: string;
    defaultAvatarSkin?: string;
  }) =>
    (
      await getAuthApiClient().patch<UserPreferences>(
        "/users/me/preferences",
        patch,
      )
    ).data,
  setLogo: (file: File | null) => upload("/users/me/logo", file),
  addAvatar: (file: File) => upload("/users/me/avatars", file),
  removeAvatar: async (url: string) =>
    (
      await getAuthApiClient().delete<UserPreferences>("/users/me/avatars", {
        params: { url },
      })
    ).data,
};
