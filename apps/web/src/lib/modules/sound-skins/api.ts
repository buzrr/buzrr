import type { SoundSkin, SoundSlot } from "@buzrr/contract";
import {
  createPlayerAuthedApiClient,
  getAuthApiClient,
} from "@/lib/api/client";

export const soundSkinsApi = {
  /** The user's own skins plus every global one. */
  list: async () =>
    (await getAuthApiClient().get<SoundSkin[]>("/sound-skins")).data,
  /** A game's skin — players load it with their player token. */
  get: async (id: string, as: "account" | "player" = "account") =>
    (
      await (
        as === "player" ? createPlayerAuthedApiClient() : getAuthApiClient()
      ).get<SoundSkin>(`/sound-skins/${encodeURIComponent(id)}`)
    ).data,
  create: async (name: string) =>
    (await getAuthApiClient().post<SoundSkin>("/sound-skins", { name })).data,
  update: async (id: string, body: { name?: string; isGlobal?: boolean }) =>
    (await getAuthApiClient().patch<SoundSkin>(`/sound-skins/${id}`, body))
      .data,
  setSlot: async (id: string, slot: SoundSlot, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return (
      await getAuthApiClient().post<SoundSkin>(
        `/sound-skins/${id}/slots/${slot}`,
        fd,
      )
    ).data;
  },
  clearSlot: async (id: string, slot: SoundSlot) =>
    (
      await getAuthApiClient().delete<SoundSkin>(
        `/sound-skins/${id}/slots/${slot}`,
      )
    ).data,
  remove: async (id: string) => {
    await getAuthApiClient().delete(`/sound-skins/${id}`);
  },
};
