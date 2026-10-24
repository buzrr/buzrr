"use client";

import { ProLock, useHasPro } from "@/components/Billing/ProFeature";
import clsx from "clsx";
import { useState } from "react";
import { toast } from "react-toastify";
import {
  LuCheck,
  LuCopy,
  LuFlaskConical,
  LuRotateCcw,
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
  builtinRenderSec,
  builtinTuschZeroMs,
  isLoopSlot,
  playBuiltin,
  playCue,
  type BuiltinSkinId,
} from "@/lib/sound/synth";
import { DEFAULT_SONG_VOLUME, fadeInOf, playSong } from "@/lib/sound/song";
import { fetchClip } from "@/lib/sound/preload";
import { SkinTestBench, type SlotPlayer } from "./SkinTestBench";
import { SlotRow, usePlayback, type SlotStarter } from "./SlotRow";
import {
  useClearSoundSlot,
  useCreateSoundSkin,
  useDeleteSoundSkin,
  useBuiltinOptionsQuery,
  useCloneBuiltin,
  useResetBuiltinOptions,
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
/** The built-in skins have every slot (the last question's: stepped-up synth). */
const BUILTIN_SLOTS = SLOTS;

/** The last question's slots and what plays when they are empty. */
const LAST_FALLBACK: Partial<Record<SoundSlot, SoundSlot>> = {
  lastCountdown: "countdown",
  lastQuestion: "question",
};

type PlayExtra = Parameters<SlotPlayer>[1];

/** A built-in slot with the superadmin's options, timed for its playhead. */
function builtinStarter(
  id: BuiltinSkinId,
  slot: SoundSlot,
  o: SoundSlotOptions | undefined,
  extra: PlayExtra = {},
): SlotStarter {
  return (onTimeline) => {
    const handle = playBuiltin(id, slot, {
      progress: () => 0.85,
      volume: 0.45 * ((o?.volume ?? DEFAULT_SONG_VOLUME) / DEFAULT_SONG_VOLUME),
      fadeInSec: fadeInOf(slot, o),
      repeat: o?.repeat === false ? false : undefined,
      remainingMs: extra.remainingMs ?? 5000,
      ...(extra.progress ? { progress: extra.progress } : {}),
    });
    // The waveform shows a rendered stretch of the synth: loop over it.
    const len = builtinRenderSec(slot) * 1000;
    onTimeline({
      startWall: Date.now(),
      fileStartMs: 0,
      ...(isLoopSlot(slot) && o?.repeat !== false
        ? { loop: { fromMs: 0, toMs: len } }
        : {}),
    });
    return handle;
  };
}

/** A user skin's cue played in a built-in variant. */
function cueStarter(
  variant: BuiltinSkinId,
  slot: SoundSlot,
  o: SoundSlotOptions | undefined,
): SlotStarter {
  return (onTimeline) => {
    if (!isCueSlot(slot)) return null;
    playCue(
      variant,
      slot,
      (o?.volume ?? DEFAULT_SONG_VOLUME) / DEFAULT_SONG_VOLUME,
    );
    onTimeline({ startWall: Date.now(), fileStartMs: 0 });
    return { stop: () => undefined };
  };
}

/** An uploaded song, played like the game (countdown 5 s, a question N s). */
function fileStarter(
  url: string,
  slot: SoundSlot,
  o: SoundSlotOptions | undefined,
  untilEndMs: number | null,
  startMs?: number,
): SlotStarter {
  return (onTimeline) =>
    playSong(
      () => fetchClip(url),
      slot,
      startMs !== undefined ? { ...o, startMs } : o,
      { untilEndMs },
      url,
      onTimeline,
    );
}

const previewUntilEnd = (slot: SoundSlot, questionMs: number) =>
  isCountdownSlot(slot) ? 5000 : isQuestionSlot(slot) ? questionMs : null;

/** "Test" toggle: a question round played like in a game. */
function TestToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
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
      Test bench
    </button>
  );
}

/**
 * How long after 0 the question music waits for the countdown song: until
 * its "question music starts" point, else its extend (end-aligned).
 */
function tailOf(o: SoundSlotOptions | undefined, hasFile: boolean): number {
  if (!hasFile || !o) return 0;
  const zero = o.align === "end" ? (o.endMs ?? 0) : (o.startMs ?? 0) + 5000;
  if (o.nextAtMs !== undefined) return Math.max(0, o.nextAtMs - zero);
  return o.align === "end" ? (o.extendSec ?? 0) * 1000 : 0;
}
function countdownTail(skin: SoundSkin, slot: "countdown" | "lastCountdown") {
  return tailOf(skin.options?.[slot], Boolean(skin.slots[slot]));
}

/**
 * Built-in skins and the user's own skins, row by row the same: each slot
 * with Play (opens it: waveform + playhead) and its options. Built-in skins
 * have no uploads, and only the superadmin changes their options.
 */
export default function SoundSkinsClient() {
  const role = useCurrentRole();
  // Only the superadmin shares a skin with everyone.
  const isAdmin = role === "superadmin";
  const query = useSoundSkinsQuery();
  const create = useCreateSoundSkin();
  const [name, setName] = useState("");
  const prefs = usePreferencesQuery();
  const defaultId = prefs.data?.defaultSoundSkin ?? "builtin:show";
  const hasPro = useHasPro();

  return (
    <div className="mt-4 flex flex-col gap-5 text-dark dark:text-white max-w-5xl">
      <p className={clsx("text-sm", mutedText)}>
        Music and effects for your games. Your default applies to all your
        quizzes; each quiz can pick another skin in its settings.
      </p>
      {BUILTIN_SOUND_SKINS.map((id) => (
        <BuiltinSkinCard
          key={id}
          id={id as BuiltinSkinId}
          isSuperadmin={role === "superadmin"}
          isDefault={defaultId === id}
        />
      ))}

      {query.isPending ? (
        <p className={mutedText}>Loading…</p>
      ) : (
        (query.data ?? []).length > 0 && (
          <section className={clsx(panelClass, "p-5 flex flex-col gap-3")}>
            <h2 className="text-lg font-bold">Your audio skins</h2>
            {(query.data ?? []).map((skin) => (
              <SkinCard
                key={skin.id}
                skin={skin}
                isAdmin={isAdmin}
                isDefault={defaultId === skin.id}
              />
            ))}
          </section>
        )
      )}

      <section className={clsx(panelClass, "p-5 flex flex-col gap-3")}>
        <h2 className="text-lg font-bold flex items-center gap-2">
          New audio skin
          {hasPro === false && <ProLock what="Your own audio skins" />}
        </h2>
        {hasPro !== false && (
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
              placeholder="New audio skin name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              containerClassName="flex-1"
            />
            <Button size="sm" type="submit" disabled={create.isPending}>
              Create
            </Button>
          </form>
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
  const prefs = usePreferencesQuery();
  const update = useUpdatePreferences();
  if ((prefs.data?.defaultSoundSkin ?? "builtin:show") === id) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-dprimary/15 px-3 py-1 text-xs font-bold text-lprimary dark:text-dprimary">
        <LuCheck size={13} /> Default
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
            onSuccess: () => toast.success("Default audio skin set"),
            onError: (err) => toast.error(getApiErrorMessage(err)),
          },
        )
      }
      className="rounded-xl bg-lprimary dark:bg-dprimary px-3 py-1 text-xs font-bold text-white dark:text-dark cursor-pointer disabled:opacity-50"
    >
      Make default
    </button>
  );
}

function BuiltinSkinCard({
  id,
  isSuperadmin,
  isDefault,
}: {
  id: BuiltinSkinId;
  isSuperadmin: boolean;
  isDefault: boolean;
}) {
  const builtinOptions = useBuiltinOptionsQuery();
  const setBuiltin = useSetBuiltinOptions();
  const reset = useResetBuiltinOptions();
  const clone = useCloneBuiltin();
  const hasPro = useHasPro();
  const playback = usePlayback();
  const [testing, setTesting] = useState(false);
  const data = builtinOptions.data?.[id];
  const optionsOf = (slot: SoundSlot) => data?.options[slot];
  // Recordings the superadmin gave this skin (others are synthesized).
  const fileOf = (slot: SoundSlot) => data?.slots[slot];
  const slots = SLOTS.filter(
    (s) => (BUILTIN_SLOTS as readonly SoundSlot[]).includes(s) || fileOf(s),
  );
  const starterFor = (slot: SoundSlot, extra: PlayExtra = {}) => {
    const url = fileOf(slot);
    return url
      ? fileStarter(
          url,
          slot,
          optionsOf(slot),
          extra.remainingMs ?? null,
          extra.startMs,
        )
      : builtinStarter(id, slot, optionsOf(slot), extra);
  };
  const tail = (slot: "countdown" | "lastCountdown") =>
    tailOf(optionsOf(slot), Boolean(fileOf(slot)));

  return (
    <section
      className={clsx(
        panelClass,
        "p-5 flex flex-col gap-2",
        isDefault && defaultBoxClass,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">{BUILTIN_SKINS[id].name}</h2>
          <p className={clsx("text-xs", mutedText)}>
            {id === "builtin:show"
              ? "Built in · recordings"
              : "Built in · synthesized in the browser"}
            {isSuperadmin && ` · Playback options (superadmin, for all users)`}
          </p>
        </div>
        <DefaultSkinButton id={id} />
        <TestToggle
          open={testing}
          onClick={() => {
            playback.stopAll();
            setTesting(!testing);
          }}
        />
        {hasPro === false ? (
          <ProLock what="Your own audio skins" />
        ) : (
          <button
            type="button"
            disabled={clone.isPending}
            onClick={() =>
              clone.mutate(
                {
                  skinId: id,
                  name: `${BUILTIN_SKINS[id].name} (copy)`,
                },
                {
                  onSuccess: () => toast.success("Copied to your audio skins"),
                  onError: (err) => toast.error(getApiErrorMessage(err)),
                },
              )
            }
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold bg-lprimary/10 dark:bg-white/5 cursor-pointer disabled:opacity-50"
          >
            <LuCopy size={11} />
            Clone to own
          </button>
        )}
        {isSuperadmin && (
          <button
            type="button"
            disabled={reset.isPending}
            onClick={() => {
              if (
                window.confirm("Reset this skin's options to their defaults?")
              ) {
                reset.mutate(id, {
                  onError: (err) => toast.error(getApiErrorMessage(err)),
                });
              }
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold bg-lprimary/10 dark:bg-white/5 cursor-pointer disabled:opacity-50"
          >
            <LuRotateCcw size={11} />
            Reset options
          </button>
        )}
      </div>
      {testing && (
        <SkinTestBench
          hasLastQuestion
          countdownTailMs={tail("countdown")}
          lastCountdownTailMs={
            fileOf("lastCountdown") ? tail("lastCountdown") : undefined
          }
          tuschZeroMs={
            fileOf("end")
              ? (optionsOf("end")?.endMs ?? 0)
              : builtinTuschZeroMs(id)
          }
          play={(asked, extra) => {
            // Every built-in slot plays: a file, or the synth.
            return playback.start(asked, starterFor(asked, extra), false);
          }}
        />
      )}
      {slots.map((slot) => {
        const url = fileOf(slot);
        return (
          <SlotRow
            key={slot}
            slot={slot}
            label={SLOT_LABELS[slot]}
            playback={playback}
            starter={(questionMs) =>
              starterFor(slot, {
                remainingMs: previewUntilEnd(slot, questionMs) ?? undefined,
              })
            }
            wave={url ? { url } : { skinId: id }}
            options={optionsOf(slot)}
            editable={isSuperadmin}
            builtin={!url}
            onSave={(next) =>
              setBuiltin.mutate(
                {
                  skinId: id,
                  options: { ...data?.options, [slot]: next },
                },
                { onError: (err) => toast.error(getApiErrorMessage(err)) },
              )
            }
          />
        );
      })}
    </section>
  );
}

function SkinCard({
  skin,
  isAdmin,
  isDefault,
}: {
  skin: SoundSkin;
  isAdmin: boolean;
  isDefault: boolean;
}) {
  const update = useUpdateSoundSkin();
  const setSlot = useSetSoundSlot();
  const clearSlot = useClearSoundSlot();
  const del = useDeleteSoundSkin();
  const onError = (err: unknown) => toast.error(getApiErrorMessage(err));
  const playback = usePlayback();
  const [testing, setTesting] = useState(false);
  const saveOptions = (slot: SoundSlot, next: SoundSlotOptions) =>
    update.mutate(
      { id: skin.id, options: { ...skin.options, [slot]: next } },
      { onError },
    );

  const benchPlay: SlotPlayer = (asked, extra) => {
    // No song for the last countdown / question: the usual one.
    const slot: SoundSlot = skin.slots[asked]
      ? asked
      : (LAST_FALLBACK[asked] ?? asked);
    const url = skin.slots[slot];
    if (!url) return null;
    return playback.start(
      slot,
      fileStarter(
        url,
        slot,
        skin.options?.[slot],
        extra.remainingMs ?? null,
        extra.startMs,
      ),
      false,
    );
  };

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
          aria-label="Audio skin name"
          onBlur={(e) =>
            e.target.value !== skin.name &&
            update.mutate({ id: skin.id, name: e.target.value }, { onError })
          }
          className="flex-1 min-w-40 bg-transparent font-bold text-base outline-none border-b border-transparent focus:border-dprimary"
        />
        {isAdmin ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              aria-label="For all users"
              checked={skin.isGlobal}
              onCheckedChange={(checked) =>
                update.mutate({ id: skin.id, isGlobal: checked }, { onError })
              }
            />
            For all users
          </label>
        ) : (
          skin.isGlobal && (
            <span className="text-xs rounded-full px-2 py-0.5 bg-lprimary/10">
              For all users
            </span>
          )
        )}
        <DefaultSkinButton id={skin.id} />
        <TestToggle
          open={testing}
          onClick={() => {
            playback.stopAll();
            setTesting(!testing);
          }}
        />
        <button
          type="button"
          aria-label="Delete audio skin"
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
          play={benchPlay}
        />
      )}
      {SLOTS.map((slot) => {
        const url = skin.slots[slot];
        const o = skin.options?.[slot];
        // Lobby cues: a built-in skin's sound, none, or the uploaded file.
        const cue = isCueSlot(slot);
        const source: CueSource | null = cue
          ? (o?.source ?? (url ? "custom" : "builtin:show"))
          : null;
        const ownFile = !cue || source === "custom";
        const variant =
          source && source !== "custom" && source !== "off"
            ? (source as BuiltinSkinId)
            : null;
        const wave = variant
          ? { skinId: variant }
          : ownFile && url
            ? { url }
            : null;
        const starter = variant
          ? () => cueStarter(variant, slot, o)
          : ownFile && url
            ? (questionMs: number) =>
                fileStarter(url, slot, o, previewUntilEnd(slot, questionMs))
            : null;
        return (
          <SlotRow
            key={slot}
            slot={slot}
            label={SLOT_LABELS[slot]}
            playback={playback}
            starter={starter}
            wave={wave}
            options={o}
            editable
            builtin={false}
            onSave={(next) => saveOptions(slot, next)}
            controls={
              <>
                {cue && (
                  <select
                    value={source!}
                    aria-label={SLOT_LABELS[slot]}
                    onChange={(e) =>
                      saveOptions(slot, {
                        ...o,
                        source: e.target.value as CueSource,
                      })
                    }
                    className="rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent px-2 py-1 text-xs"
                  >
                    {BUILTIN_SOUND_SKINS.map((id) => (
                      <option key={id} value={id}>
                        {BUILTIN_SKINS[id as BuiltinSkinId].name}
                      </option>
                    ))}
                    <option value="off">Off</option>
                    <option value="custom">Own file</option>
                  </select>
                )}
                {ownFile && !url && (
                  <span className={clsx("text-xs", mutedText)}>silent</span>
                )}
                {ownFile && url && (
                  <button
                    type="button"
                    onClick={() => {
                      playback.stop(slot);
                      clearSlot.mutate({ id: skin.id, slot }, { onError });
                    }}
                    className="text-xs underline cursor-pointer"
                  >
                    remove
                  </button>
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
                              onSuccess: () => toast.success("Sound uploaded"),
                              onError,
                            },
                          );
                        }
                      }}
                    />
                  </label>
                )}
              </>
            }
          />
        );
      })}
    </div>
  );
}
