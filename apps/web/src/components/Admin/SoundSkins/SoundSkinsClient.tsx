"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  LuCheck,
  LuFlaskConical,
  LuPlay,
  LuSettings2,
  LuSquare,
  LuTrash2,
  LuUpload,
} from "react-icons/lu";
import {
  BUILTIN_SOUND_SKINS,
  isCountdownSlot,
  isCueSlot,
  isQuestionSlot,
  soundSlotSchema,
  type CueSource,
  type SoundSkin,
  type SoundSlot,
  type SoundSlotOptions,
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
  builtinTuschZeroMs,
  playBuiltin,
  playCue,
  type BuiltinSkinId,
  type SoundHandle,
} from "@/lib/sound/synth";
import { DEFAULT_SONG_VOLUME, fadeInOf, playSong } from "@/lib/sound/song";
import { fetchClip } from "@/lib/sound/preload";
import { SlotOptionsEditor } from "./SlotOptionsEditor";
import { SkinTestBench } from "./SkinTestBench";
import { useT } from "@/lib/i18n/context";
import {
  useClearSoundSlot,
  useCreateSoundSkin,
  useDeleteSoundSkin,
  useBuiltinOptionsQuery,
  useSetBuiltinOptions,
  useSetSoundSlot,
  useSoundSkinsQuery,
  useUpdateSoundSkin,
} from "@/lib/modules/sound-skins/hooks";

export const SLOT_LABELS: Record<SoundSlot, string> = {
  lobby: "Background music (lobby, get ready)",
  countdown: "Countdown before a question",
  lastCountdown: "Countdown before the last question (empty: as above)",
  join: "Ping when a player joins (host, lobby)",
  bubble: "Bubble pop (host, lobby)",
  reaction: "Reaction from a player (host)",
  question: "Music while a question runs",
  lastQuestion: "Music for the last question (empty: as above)",
  end: "Tusch when a question ends",
  reveal: "Results animation",
  scores: "Party music on the scoreboard",
  final: "Big party at the very end",
};

const SLOTS = soundSlotSchema.options;
/** The built-in skins have one question music (no separate last one). */
const BUILTIN_SLOTS = SLOTS.filter(
  (s) => s !== "lastQuestion" && s !== "lastCountdown",
);

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

/** Preview of an uploaded song with its options (a 20 s question, the 5 s countdown). */
function fileHandle(
  url: string,
  slot: SoundSlot,
  options: SoundSlotOptions | undefined,
): SoundHandle {
  const untilEndMs = isCountdownSlot(slot)
    ? 5000
    : isQuestionSlot(slot)
      ? 20_000
      : null;
  return playSong(() => fetchClip(url), slot, options, { untilEndMs }, url);
}

/** Preview of a built-in slot with the superadmin's options. */
function builtinHandle(
  id: string,
  slot: SoundSlot,
  o: SoundSlotOptions | undefined,
  extra: { remainingMs?: number; progress?: () => number } = {},
): SoundHandle {
  return playBuiltin(id as BuiltinSkinId, slot, {
    progress: () => 0.85,
    volume: 0.45 * ((o?.volume ?? DEFAULT_SONG_VOLUME) / DEFAULT_SONG_VOLUME),
    fadeInSec: fadeInOf(slot, o),
    repeat: o?.repeat === false ? false : undefined,
    ...extra,
  });
}

/** "Test" toggle: a question round played like in a game. */
function TestToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold cursor-pointer",
        open ? "bg-dprimary/20" : "bg-lprimary/10 dark:bg-white/5",
      )}
    >
      <LuFlaskConical size={11} />
      {t("Test bench")}
    </button>
  );
}

/** The last question's slots and what plays when they are empty. */
const LAST_FALLBACK: Partial<Record<SoundSlot, SoundSlot>> = {
  lastCountdown: "countdown",
  lastQuestion: "question",
};

/** How long a countdown song plays on after 0 (end-aligned only). */
function countdownTail(skin: SoundSkin, slot: "countdown" | "lastCountdown") {
  const o = skin.options?.[slot];
  return skin.slots[slot] && o?.align === "end" ? (o.extendSec ?? 0) * 1000 : 0;
}

/** The gear that opens a slot's options. */
function OptionsToggle({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold cursor-pointer",
        open ? "bg-dprimary/20" : "bg-lprimary/10 dark:bg-white/5",
      )}
    >
      <LuSettings2 size={11} />
      {t("Options")}
    </button>
  );
}

/**
 * Built-in skins (preview only) and the user's own skins: an uploaded sound
 * per moment. Admins can offer a skin to every user.
 */
export default function SoundSkinsClient() {
  const t = useT();
  const role = useCurrentRole();
  const isAdmin = role === "admin" || role === "superadmin";
  const isSuperadmin = role === "superadmin";
  const builtinOptions = useBuiltinOptionsQuery();
  const setBuiltin = useSetBuiltinOptions();
  const [openBuiltin, setOpenBuiltin] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
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
            {BUILTIN_SLOTS.map((slot) => {
              const key = `${id}:${slot}`;
              return (
                <button
                  key={slot}
                  type="button"
                  title={t(SLOT_LABELS[slot])}
                  onClick={() =>
                    preview.play(key, () =>
                      builtinHandle(
                        id,
                        slot,
                        builtinOptions.data?.[id]?.[slot],
                      ),
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
            <TestToggle
              open={testing === id}
              onClick={() => {
                preview.stop();
                setTesting(testing === id ? null : id);
              }}
            />
          </div>
          {testing === id && (
            <SkinTestBench
              tuschZeroMs={builtinTuschZeroMs(id as BuiltinSkinId)}
              play={(slot, extra) =>
                builtinHandle(
                  id,
                  slot,
                  builtinOptions.data?.[id]?.[slot],
                  extra,
                )
              }
            />
          )}
          {isSuperadmin && (
            // Only the superadmin tunes the built-in skins, for everyone.
            <div className="flex flex-col gap-1.5">
              <p className={clsx("text-xs", mutedText)}>
                {t("Playback options (superadmin, for all users)")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BUILTIN_SLOTS.map((slot) => {
                  const key = `${id}:${slot}`;
                  return (
                    <span key={slot} className="flex items-center gap-1">
                      <span className="text-xs">{slot}</span>
                      <OptionsToggle
                        open={openBuiltin === key}
                        onClick={() =>
                          setOpenBuiltin(openBuiltin === key ? null : key)
                        }
                      />
                    </span>
                  );
                })}
              </div>
              {BUILTIN_SLOTS.filter(
                (slot) => openBuiltin === `${id}:${slot}`,
              ).map((slot) => (
                <div key={slot} className="flex flex-col gap-1">
                  <span className="text-xs font-bold">
                    {t(SLOT_LABELS[slot])}
                  </span>
                  <SlotOptionsEditor
                    slot={slot}
                    builtin
                    value={builtinOptions.data?.[id]?.[slot]}
                    onSave={(next) =>
                      setBuiltin.mutate(
                        {
                          skinId: id,
                          options: {
                            ...builtinOptions.data?.[id],
                            [slot]: next,
                          },
                        },
                        {
                          onError: (err) =>
                            toast.error(getApiErrorMessage(err)),
                        },
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}
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
  const [openSlot, setOpenSlot] = useState<SoundSlot | null>(null);
  const [testing, setTesting] = useState(false);

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
        <TestToggle
          open={testing}
          onClick={() => {
            preview.stop();
            setTesting(!testing);
          }}
        />
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
      {testing && (
        <SkinTestBench
          hasLastQuestion={Boolean(
            skin.slots.lastQuestion || skin.slots.lastCountdown,
          )}
          countdownTailMs={countdownTail(skin, "countdown")}
          tuschZeroMs={skin.slots.end ? (skin.options?.end?.endMs ?? 0) : 0}
          lastCountdownTailMs={
            skin.slots.lastCountdown
              ? countdownTail(skin, "lastCountdown")
              : undefined
          }
          play={(asked, extra) => {
            // No song for the last countdown / question: the usual one.
            const slot: SoundSlot = skin.slots[asked]
              ? asked
              : (LAST_FALLBACK[asked] ?? asked);
            const url = skin.slots[slot];
            return url
              ? playSong(
                  () => fetchClip(url),
                  slot,
                  extra.startMs !== undefined
                    ? { ...skin.options?.[slot], startMs: extra.startMs }
                    : skin.options?.[slot],
                  { untilEndMs: extra.remainingMs ?? null },
                  url,
                )
              : null;
          }}
        />
      )}
      {SLOTS.map((slot) => {
        const url = skin.slots[slot];
        const key = `${skin.id}:${slot}`;
        // Lobby cues: a built-in skin's sound, none, or the uploaded file.
        const cue = isCueSlot(slot);
        const source: CueSource | null = cue
          ? (skin.options?.[slot]?.source ?? (url ? "custom" : "builtin:show"))
          : null;
        const ownFile = !cue || source === "custom";
        return (
          <div key={slot} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-64 max-w-full">{t(SLOT_LABELS[slot])}</span>
              {cue && (
                <>
                  <select
                    value={source!}
                    aria-label={t(SLOT_LABELS[slot])}
                    onChange={(e) =>
                      update.mutate(
                        {
                          id: skin.id,
                          options: {
                            ...skin.options,
                            [slot]: {
                              ...skin.options?.[slot],
                              source: e.target.value as CueSource,
                            },
                          },
                        },
                        { onError },
                      )
                    }
                    className="rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent px-2 py-1 text-xs"
                  >
                    {BUILTIN_SOUND_SKINS.map((id) => (
                      <option key={id} value={id}>
                        {t(BUILTIN_SKINS[id as BuiltinSkinId].name)}
                      </option>
                    ))}
                    <option value="off">{t("Off")}</option>
                    <option value="custom">{t("Own file")}</option>
                  </select>
                  {source !== "custom" && source !== "off" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          preview.play(key, () => {
                            playCue(
                              source as BuiltinSkinId,
                              slot,
                              (skin.options?.[slot]?.volume ??
                                DEFAULT_SONG_VOLUME) / DEFAULT_SONG_VOLUME,
                            );
                            return { stop: () => undefined };
                          })
                        }
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold bg-lprimary/10 dark:bg-white/5 cursor-pointer"
                      >
                        <LuPlay size={11} />
                        {t("Play")}
                      </button>
                      <OptionsToggle
                        open={openSlot === slot}
                        onClick={() =>
                          setOpenSlot(openSlot === slot ? null : slot)
                        }
                      />
                    </>
                  )}
                </>
              )}
              {!ownFile ? null : url ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      preview.play(key, () =>
                        fileHandle(url, slot, skin.options?.[slot]),
                      )
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
                  <OptionsToggle
                    open={openSlot === slot}
                    onClick={() => setOpenSlot(openSlot === slot ? null : slot)}
                  />
                </>
              ) : (
                <span className={clsx("text-xs", mutedText)}>
                  {t("silent")}
                </span>
              )}
              {ownFile && (
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
              )}
            </div>
            {(url || cue) && openSlot === slot && (
              <SlotOptionsEditor
                slot={slot}
                builtin={false}
                url={ownFile ? url : undefined}
                value={skin.options?.[slot]}
                onSave={(next) =>
                  update.mutate(
                    {
                      id: skin.id,
                      options: { ...skin.options, [slot]: next },
                    },
                    { onError },
                  )
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
