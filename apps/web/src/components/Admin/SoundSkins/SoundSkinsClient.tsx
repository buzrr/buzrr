"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { LuCheck, LuPlay, LuSquare, LuTrash2, LuUpload } from "react-icons/lu";
import {
  BUILTIN_SOUND_SKINS,
  soundSlotSchema,
  type SoundSkin,
  type SoundSlot,
} from "@buzrr/contract";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCurrentRole } from "@/components/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { TextInput } from "@/components/ui/TextInput";
import { mutedText, panelClass } from "@/components/Game/GameUI";
import {
  usePreferencesQuery,
  useUpdatePreferences,
} from "@/lib/modules/preferences/hooks";
import {
  BUILTIN_SKINS,
  audioContext,
  isLoopSlot,
  playBuiltin,
  type BuiltinSkinId,
  type SoundHandle,
} from "@/lib/sound/synth";
import { useT } from "@/lib/i18n/context";
import {
  useClearSoundSlot,
  useCreateSoundSkin,
  useDeleteSoundSkin,
  useSetSoundSlot,
  useSoundSkinsQuery,
  useUpdateSoundSkin,
} from "@/lib/modules/sound-skins/hooks";

export const SLOT_LABELS: Record<SoundSlot, string> = {
  lobby: "Background music (lobby, get ready)",
  countdown: "Countdown before a question",
  question: "Music while a question runs",
  end: "Tusch when a question ends",
  reveal: "Results animation",
  scores: "Party music on the scoreboard",
  final: "Big party at the very end",
};

const SLOTS = soundSlotSchema.options;

/** One preview at a time across the page. */
function usePreview() {
  const handle = useRef<SoundHandle | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => handle.current?.stop(), []);
  const stop = () => {
    handle.current?.stop();
    handle.current = null;
    setPlaying(null);
  };
  const play = (key: string, start: () => SoundHandle) => {
    const same = playing === key;
    stop();
    if (same) return;
    void audioContext()?.resume();
    handle.current = start();
    setPlaying(key);
  };
  return { playing, play, stop };
}

function fileHandle(url: string, loop: boolean): SoundHandle {
  const a = new Audio(url);
  a.loop = loop;
  void a.play().catch(() => undefined);
  return { stop: () => a.pause() };
}

/**
 * Built-in skins (preview only) and the user's own skins: an uploaded sound
 * per moment. Admins can offer a skin to every user.
 */
export default function SoundSkinsClient() {
  const t = useT();
  const role = useCurrentRole();
  const isAdmin = role === "admin" || role === "superadmin";
  const query = useSoundSkinsQuery();
  const create = useCreateSoundSkin();
  const [name, setName] = useState("");
  const preview = usePreview();
  const prefs = usePreferencesQuery();
  const defaultId = prefs.data?.defaultSoundSkin ?? "builtin:show";

  return (
    <div className="mt-4 flex flex-col gap-5 text-dark dark:text-white max-w-5xl">
      <p className={clsx("text-sm", mutedText)}>
        {t(
          "Music and effects for your games. Your default applies to all your quizzes; each quiz can pick another skin in its settings.",
        )}
      </p>
      {BUILTIN_SOUND_SKINS.map((id) => (
        <section
          key={id}
          className={clsx(
            panelClass,
            "p-5 flex flex-col gap-3",
            defaultId === id && defaultBoxClass,
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">
                {t(BUILTIN_SKINS[id as BuiltinSkinId].name)}
              </h2>
              <p className={clsx("text-xs", mutedText)}>
                {t("Built in · synthesized in the browser")}
              </p>
            </div>
            <span className="ml-auto">
              <DefaultSkinButton id={id} />
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {SLOTS.map((slot) => {
              const key = `${id}:${slot}`;
              return (
                <button
                  key={slot}
                  type="button"
                  title={t(SLOT_LABELS[slot])}
                  onClick={() =>
                    preview.play(key, () =>
                      playBuiltin(id as BuiltinSkinId, slot, {
                        progress: () => 0.85,
                      }),
                    )
                  }
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold bg-lprimary/10 dark:bg-white/5 cursor-pointer"
                >
                  {preview.playing === key ? (
                    <LuSquare size={11} />
                  ) : (
                    <LuPlay size={11} />
                  )}
                  {slot}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section className={clsx(panelClass, "p-5 flex flex-col gap-3")}>
        <h2 className="text-lg font-bold">{t("Your audio skins")}</h2>
        <form
          className="flex gap-2 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(name || "My sounds", {
              onSuccess: () => setName(""),
              onError: (err) => toast.error(getApiErrorMessage(err)),
            });
          }}
        >
          <TextInput
            placeholder={t("New audio skin name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            containerClassName="flex-1"
          />
          <Button size="sm" type="submit" disabled={create.isPending}>
            {t("Create")}
          </Button>
        </form>
        {query.isPending ? (
          <p className={mutedText}>{t("Loading…")}</p>
        ) : (query.data ?? []).length === 0 ? (
          <p className={mutedText}>{t("No audio skins yet.")}</p>
        ) : (
          (query.data ?? []).map((skin) => (
            <SkinCard
              key={skin.id}
              skin={skin}
              isAdmin={isAdmin}
              preview={preview}
              isDefault={defaultId === skin.id}
            />
          ))
        )}
      </section>
    </div>
  );
}

/** The default skin's box: tinted and ringed, like on Avatar Skins. */
export const defaultBoxClass =
  "ring-2 ring-dprimary !bg-dprimary/8 dark:!bg-dprimary/10";

/** "Default" badge, or the button that makes this skin the default. */
export function DefaultSkinButton({ id }: { id: string }) {
  const t = useT();
  const prefs = usePreferencesQuery();
  const update = useUpdatePreferences();
  if ((prefs.data?.defaultSoundSkin ?? "builtin:show") === id) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-dprimary/15 px-3 py-1 text-xs font-bold text-lprimary dark:text-dprimary">
        <LuCheck size={13} /> {t("Default")}
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={update.isPending || !prefs.data}
      onClick={() =>
        update.mutate(
          { defaultSoundSkin: id },
          {
            onSuccess: () => toast.success(t("Default audio skin set")),
            onError: (err) => toast.error(getApiErrorMessage(err)),
          },
        )
      }
      className="rounded-xl bg-lprimary dark:bg-dprimary px-3 py-1 text-xs font-bold text-white dark:text-dark cursor-pointer disabled:opacity-50"
    >
      {t("Make default")}
    </button>
  );
}

function SkinCard({
  skin,
  isAdmin,
  preview,
  isDefault,
}: {
  skin: SoundSkin;
  isAdmin: boolean;
  preview: ReturnType<typeof usePreview>;
  isDefault: boolean;
}) {
  const t = useT();
  const update = useUpdateSoundSkin();
  const setSlot = useSetSoundSlot();
  const clearSlot = useClearSoundSlot();
  const del = useDeleteSoundSkin();
  const onError = (err: unknown) => toast.error(getApiErrorMessage(err));

  return (
    <div
      className={clsx(
        "rounded-2xl border border-lprimary/15 dark:border-white/10 p-4 flex flex-col gap-2",
        isDefault && defaultBoxClass,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <input
          defaultValue={skin.name}
          maxLength={60}
          aria-label={t("Audio skin name")}
          onBlur={(e) =>
            e.target.value !== skin.name &&
            update.mutate({ id: skin.id, name: e.target.value }, { onError })
          }
          className="flex-1 min-w-40 bg-transparent font-bold text-base outline-none border-b border-transparent focus:border-dprimary"
        />
        {isAdmin ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              aria-label={t("For all users")}
              checked={skin.isGlobal}
              onCheckedChange={(checked) =>
                update.mutate({ id: skin.id, isGlobal: checked }, { onError })
              }
            />
            {t("For all users")}
          </label>
        ) : (
          skin.isGlobal && (
            <span className="text-xs rounded-full px-2 py-0.5 bg-lprimary/10">
              {t("For all users")}
            </span>
          )
        )}
        <DefaultSkinButton id={skin.id} />
        <button
          type="button"
          aria-label={t("Delete audio skin")}
          onClick={() => {
            if (window.confirm(`Delete "${skin.name}"?`)) {
              del.mutate(skin.id, { onError });
            }
          }}
          className="size-9 rounded-[10px] flex items-center justify-center hover:bg-[#e5544e]/14 hover:text-[#e5544e] cursor-pointer"
        >
          <LuTrash2 size={17} />
        </button>
      </div>
      {SLOTS.map((slot) => {
        const url = skin.slots[slot];
        const key = `${skin.id}:${slot}`;
        return (
          <div key={slot} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-64 max-w-full">{t(SLOT_LABELS[slot])}</span>
            {url ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    preview.play(key, () => fileHandle(url, isLoopSlot(slot)))
                  }
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold bg-lprimary/10 dark:bg-white/5 cursor-pointer"
                >
                  {preview.playing === key ? (
                    <LuSquare size={11} />
                  ) : (
                    <LuPlay size={11} />
                  )}
                  {t("Play")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    clearSlot.mutate({ id: skin.id, slot }, { onError })
                  }
                  className="text-xs underline cursor-pointer"
                >
                  {t("remove")}
                </button>
              </>
            ) : (
              <span className={clsx("text-xs", mutedText)}>{t("silent")}</span>
            )}
            <label className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold border border-dashed border-lprimary/30 cursor-pointer">
              <LuUpload size={11} />
              {url ? "Replace" : "Upload"}
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.oga,.opus,.flac,.m4a,.aac,.webm"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) {
                    setSlot.mutate(
                      { id: skin.id, slot, file },
                      {
                        onSuccess: () => toast.success(t("Sound uploaded")),
                        onError,
                      },
                    );
                  }
                }}
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}
