"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  isCountdownSlot,
  isCueSlot,
  isQuestionSlot,
  type SoundSlot,
  type SoundSlotOptions,
} from "@buzrr/contract";
import { Switch } from "@/components/ui/Switch";
import { mutedText } from "@/components/Game/GameUI";
import {
  DEFAULT_SONG_VOLUME,
  REPEATABLE_SLOTS,
  fadeInOf,
  formatMs,
  parseMs,
  repeatOf,
} from "@/lib/sound/song";
import { SongWaveform, type WaveSource } from "./SongWaveform";
import type { Timeline } from "@/lib/sound/song";

const SAVE_AFTER_MS = 600;

/**
 * One slot's playback options: volume, fade-in, repeat; for a file also the
 * start point, and for the countdown / question whether the song lines up
 * with their end (end point + extend). Saves itself shortly after a change.
 */
export function SlotOptionsEditor({
  slot,
  value,
  builtin,
  wave,
  timeline,
  questionMs,
  onPastEnd,
  onSave,
}: {
  slot: SoundSlot;
  value: SoundSlotOptions | undefined;
  /** The waveform shown on top (a file: also sets the cue points). */
  wave?: WaveSource;
  /** The sound playing in this slot (playhead). */
  timeline?: Timeline | null;
  questionMs?: number;
  onPastEnd?: () => void;
  /** Built-in (synthesized) skin: no timeline, so no start / end points. */
  builtin: boolean;
  onSave: (next: SoundSlotOptions) => void;
}) {
  const [draft, setDraft] = useState<SoundSlotOptions>(value ?? {});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const change = (patch: Partial<SoundSlotOptions>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveRef.current(next), SAVE_AFTER_MS);
  };

  // Lobby cues are short sounds: volume only. The tusch has a zero point
  // (it lands on the question's end) instead of a start point.
  const cue = isCueSlot(slot);
  const tusch = slot === "end";
  const alignable = !builtin && (isCountdownSlot(slot) || isQuestionSlot(slot));
  const endAligned = alignable && draft.align === "end";
  // Countdowns: a click on the waveform sets the zero / start point, or
  // where the question music starts.
  const countdown = !builtin && isCountdownSlot(slot);
  const [cueKey, setCueKey] = useState<"main" | "next">("main");
  const volume = draft.volume ?? DEFAULT_SONG_VOLUME;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-lprimary/5 dark:bg-white/3 p-3 text-sm">
      <label className="flex flex-wrap items-center gap-3">
        <span className="w-40">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => change({ volume: Number(e.target.value) })}
          className="flex-1 min-w-32 accent-dprimary"
        />
        <span className="w-10 text-right tabular-nums">{volume}</span>
      </label>

      {!cue && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-40">Fade in at the start</span>
          <Switch
            aria-label="Fade in at the start"
            checked={fadeInOf(slot, draft) > 0}
            onCheckedChange={(on) => change({ fadeIn: on })}
          />
          {fadeInOf(slot, draft) > 0 && (
            <SecondsInput
              label="Fade time"
              value={fadeInOf(slot, draft)}
              min={0.1}
              max={30}
              onChange={(fadeInSec) => change({ fadeInSec })}
            />
          )}
        </div>
      )}

      {REPEATABLE_SLOTS.includes(slot) && !endAligned && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-40">Repeat</span>
          <Switch
            aria-label="Repeat"
            checked={
              builtin
                ? draft.repeat !== false // synth loops run on unless set off
                : repeatOf(slot, draft)
            }
            onCheckedChange={(on) => change({ repeat: on })}
          />
        </div>
      )}

      {alignable && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-40">Song starts</span>
          <select
            value={draft.align ?? "start"}
            onChange={(e) =>
              change({ align: e.target.value as "start" | "end" })
            }
            className="rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent px-2 py-1"
          >
            <option value="start">At the beginning</option>
            <option value="end">
              {isCountdownSlot(slot)
                ? "End − 5 s (the countdown)"
                : "End − the question's time"}
            </option>
          </select>
        </div>
      )}

      {wave && countdown && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className={mutedText}>A click sets:</span>
          {(
            [
              ["main", endAligned ? "Zero point (0)" : "Start point"],
              ["next", "Question music starts"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={cueKey === key}
              onClick={() => setCueKey(key)}
              className={clsx(
                "px-2.5 py-1 rounded-lg font-bold cursor-pointer",
                cueKey === key
                  ? key === "next"
                    ? "bg-[#2bb673] text-white"
                    : "bg-[#7c4ddb] text-white"
                  : "bg-lprimary/8 dark:bg-white/5",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {wave && (
        <SongWaveform
          source={wave}
          slot={slot}
          options={draft}
          questionMs={questionMs}
          timeline={timeline}
          onChange={change}
          onPastEnd={onPastEnd}
          cueKey={countdown ? cueKey : "main"}
        />
      )}
      {countdown && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-40">Question music starts</span>
          {draft.nextAtMs === undefined ? (
            <span className={clsx("text-xs", mutedText)}>
              when the countdown song is over
            </span>
          ) : (
            <TimeField
              label=""
              value={draft.nextAtMs}
              onChange={(nextAtMs) => change({ nextAtMs })}
              onFocus={() => setCueKey("next")}
            />
          )}
          {draft.nextAtMs === undefined ? (
            <button
              type="button"
              onClick={() => {
                change({ nextAtMs: draft.endMs ?? 0 });
                setCueKey("next");
              }}
              className="text-xs underline cursor-pointer"
            >
              set
            </button>
          ) : (
            <button
              type="button"
              onClick={() => change({ nextAtMs: undefined })}
              className="text-xs underline cursor-pointer"
            >
              automatic
            </button>
          )}
        </div>
      )}

      {tusch && !builtin && (
        <TimeField
          label="Zero point (0) at"
          value={draft.endMs ?? 0}
          onChange={(endMs) => change({ endMs })}
        />
      )}

      {!builtin && !endAligned && !cue && !tusch && (
        <TimeField
          label="Start at"
          value={draft.startMs ?? 0}
          onChange={(startMs) => change({ startMs })}
          onFocus={() => setCueKey("main")}
        />
      )}

      {endAligned && (
        <>
          <TimeField
            label={isCountdownSlot(slot) ? "Zero point (0) at" : "End point at"}
            value={draft.endMs ?? 0}
            onChange={(endMs) => change({ endMs })}
            onFocus={() => setCueKey("main")}
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-40">
              {isCountdownSlot(slot) ? "Plays on after 0" : "Extend by"}
            </span>
            <SecondsInput
              label={isCountdownSlot(slot) ? "Plays on after 0" : "Extend by"}
              value={draft.extendSec ?? 0}
              min={0}
              max={5}
              onChange={(extendSec) => change({ extendSec })}
            />
            <span className={clsx("text-xs", mutedText)}>
              The song plays on this long after the end, then fades out.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/** mm:ss.mmm text field (saved when valid). */
function TimeField({
  label,
  value,
  onChange,
  onFocus,
}: {
  label: string;
  value: number;
  onChange: (ms: number) => void;
  /** Focused: e.g. pick the matching waveform cue. */
  onFocus?: () => void;
}) {
  // While typing: the text as typed; otherwise the value (it also follows
  // the waveform).
  const [editing, setEditing] = useState<string | null>(null);
  const text = editing ?? formatMs(value);
  const valid = parseMs(text) !== null;
  return (
    <label className="flex flex-wrap items-center gap-3">
      {label && <span className="w-40">{label}</span>}
      <input
        value={text}
        onFocus={() => {
          setEditing(formatMs(value));
          onFocus?.();
        }}
        onChange={(e) => {
          setEditing(e.target.value);
          const ms = parseMs(e.target.value);
          if (ms !== null) onChange(ms);
        }}
        onBlur={() => setEditing(null)}
        placeholder="0:00.000"
        inputMode="decimal"
        aria-invalid={!valid}
        className={clsx(
          "w-32 rounded-lg border bg-transparent px-2 py-1 tabular-nums",
          valid
            ? "border-lprimary/20 dark:border-white/10"
            : "border-[#e5544e]",
        )}
      />
      <span className={clsx("text-xs", mutedText)}>mm:ss.mmm</span>
    </label>
  );
}

function SecondsInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (sec: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={0.1}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-20 rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent px-2 py-1 tabular-nums"
      />
      s
    </label>
  );
}
