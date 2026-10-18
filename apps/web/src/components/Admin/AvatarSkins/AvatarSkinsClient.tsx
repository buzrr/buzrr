"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/Switch";
import { useCurrentRole } from "@/components/SessionProvider";
import { ProLock, useHasPro } from "@/components/Billing/ProFeature";
import clsx from "clsx";
import { useRef } from "react";
import { LuCheck, LuImagePlus, LuTrash2 } from "react-icons/lu";
import { toast } from "react-toastify";
import {
  BUILTIN_AVATARS,
  MAX_CUSTOM_AVATARS,
  type AvatarSkin,
} from "@buzrr/contract";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  useAddAvatar,
  useSharedAvatarsQuery,
  usePreferencesQuery,
  useRemoveAvatar,
  useUpdatePreferences,
} from "@/lib/modules/preferences/hooks";
import { useT } from "@/lib/i18n/context";
import { mutedText, panelClass } from "@/components/Game/GameUI";

export const AVATAR_SKIN_NAMES: Record<AvatarSkin, string> = {
  original: "Original",
  comic: "Variant 1 · Comic",
  crazy: "Variant 2 · Crazy food",
  faces: "Variant 3 · Funny faces",
  custom: "Your skin",
  shared: "Shared skin",
};

const DESCRIPTIONS: Record<AvatarSkin, string> = {
  original: "The classic Buzrr avatars.",
  comic: "Colourful comic characters.",
  crazy: "Googly-eyed pizza, donuts, tacos & friends.",
  faces: "Friendly flat-style faces: all kinds of people, all smiling.",
  custom: "Your own pictures — up to {n}, cropped to a square automatically.",
  shared: "Offered to everyone by the superadmin.",
};

function Avatar({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- public files and uploads, square
    <img
      src={src}
      alt=""
      className="size-full rounded-full object-cover bg-lprimary/5"
      loading="lazy"
    />
  );
}

/**
 * Avatar skins: the pictures players pick from. Three built-in sets and the
 * user's own ("Your skin"); one is the default for the user's quizzes, and
 * each quiz can choose another.
 */
export default function AvatarSkinsClient() {
  const t = useT();
  const hasPro = useHasPro();
  const prefs = usePreferencesQuery();
  const update = useUpdatePreferences();
  const add = useAddAvatar();
  const remove = useRemoveAvatar();
  const input = useRef<HTMLInputElement>(null);
  const current = prefs.data?.defaultAvatarSkin ?? "original";
  const custom = prefs.data?.customAvatars ?? [];
  const role = useCurrentRole();
  const isSuperadmin = role === "superadmin";
  const shared = useSharedAvatarsQuery();
  const qc = useQueryClient();
  const sharing = prefs.data?.shareCustomAvatars ?? false;

  const makeDefault = (skin: AvatarSkin) =>
    update.mutate(
      { defaultAvatarSkin: skin },
      {
        onSuccess: () =>
          toast.success(
            t("{name} is your default", { name: t(AVATAR_SKIN_NAMES[skin]) }),
          ),
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );

  const upload = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_CUSTOM_AVATARS - custom.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > list.length) {
      toast.info(
        t("Only {n} pictures fit — the rest were skipped", {
          n: MAX_CUSTOM_AVATARS,
        }),
      );
    }
    for (const f of list) {
      try {
        await add.mutateAsync(f);
      } catch (err) {
        toast.error(`${f.name}: ${getApiErrorMessage(err)}`);
      }
    }
  };

  // "Shared": the superadmin's skin, for everyone else (the superadmin
  // shares their own "Your skin" with a switch on it).
  const skins: AvatarSkin[] = [
    "original",
    "comic",
    "crazy",
    "faces",
    ...(!isSuperadmin && (shared.data ?? []).length > 0
      ? (["shared"] as const)
      : []),
    "custom",
  ];
  return (
    <div className="mt-4 flex flex-col gap-5 max-w-5xl">
      <p className={clsx("text-sm", mutedText)}>
        {t(
          "The pictures players choose from when they join. Your default applies to all your quizzes; each quiz can pick another skin in its settings.",
        )}
      </p>
      {skins.map((skin) => {
        const pics =
          skin === "custom"
            ? custom
            : skin === "shared"
              ? (shared.data ?? [])
              : BUILTIN_AVATARS[skin];
        const isDefault = current === skin;
        return (
          <section
            key={skin}
            className={clsx(
              panelClass,
              "p-5 flex flex-col gap-3 text-dark dark:text-white",
              isDefault &&
                "ring-2 ring-dprimary !bg-dprimary/8 dark:!bg-dprimary/10",
            )}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold">
                  {t(AVATAR_SKIN_NAMES[skin])}
                </h2>
                <p className={clsx("text-xs", mutedText)}>
                  {t(DESCRIPTIONS[skin], { n: MAX_CUSTOM_AVATARS })}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {skin === "custom" && isSuperadmin && (
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      aria-label={t("For all users")}
                      checked={sharing}
                      onCheckedChange={(on) =>
                        update.mutate(
                          { shareCustomAvatars: on },
                          {
                            onSuccess: () =>
                              qc.invalidateQueries({
                                queryKey: ["shared-avatars"],
                              }),
                            onError: (err) =>
                              toast.error(getApiErrorMessage(err)),
                          },
                        )
                      }
                    />
                    {t("For all users")}
                  </label>
                )}
                {skin === "custom" && hasPro === false && (
                  <ProLock what={t("Your own avatar skin")} />
                )}
                {skin === "custom" && hasPro !== false && (
                  <>
                    <span className={clsx("text-xs", mutedText)}>
                      {custom.length} / {MAX_CUSTOM_AVATARS}
                    </span>
                    <button
                      type="button"
                      disabled={
                        add.isPending || custom.length >= MAX_CUSTOM_AVATARS
                      }
                      onClick={() => input.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-lprimary dark:border-dprimary px-3 py-1.5 text-sm font-semibold text-lprimary dark:text-dprimary cursor-pointer hover:bg-lprimary/10 disabled:opacity-50 disabled:cursor-default"
                    >
                      <LuImagePlus size={16} />
                      {add.isPending ? "Uploading…" : t("Add pictures")}
                    </button>
                    <input
                      ref={input}
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="sr-only"
                      onChange={(e) => {
                        void upload(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </>
                )}
                {isDefault ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-dprimary/15 px-3 py-1.5 text-sm font-bold text-lprimary dark:text-dprimary">
                    <LuCheck size={15} /> {t("Default")}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={
                      update.isPending ||
                      (skin === "custom" && custom.length === 0)
                    }
                    onClick={() => makeDefault(skin)}
                    className="rounded-xl bg-lprimary dark:bg-dprimary px-3 py-1.5 text-sm font-bold text-white dark:text-dark cursor-pointer disabled:opacity-50 disabled:cursor-default"
                  >
                    {t("Make default")}
                  </button>
                )}
              </div>
            </div>
            {pics.length === 0 ? (
              <p className={clsx("text-sm py-4 text-center", mutedText)}>
                {t(
                  "No pictures yet. Add up to {n} — any size, they are cropped to a square.",
                  { n: MAX_CUSTOM_AVATARS },
                )}
              </p>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2.5">
                {pics.map((src) => (
                  <div key={src} className="group relative aspect-square">
                    <Avatar src={src} />
                    {skin === "custom" && (
                      <button
                        type="button"
                        aria-label={t("Remove picture")}
                        onClick={() =>
                          remove.mutate(src, {
                            onError: (err) =>
                              toast.error(getApiErrorMessage(err)),
                          })
                        }
                        className="absolute -top-1 -right-1 size-7 rounded-full bg-white dark:bg-dark border border-lprimary/20 text-[#e5544e] flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                      >
                        <LuTrash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
