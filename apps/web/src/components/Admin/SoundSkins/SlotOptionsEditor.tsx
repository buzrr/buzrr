"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { SoundSlot, SoundSlotOptions } from "@buzrr/contract";
import { Switch } from "@/components/ui/Switch";
import { mutedText } from "@/components/Game/GameUI";
import { useT } from "@/lib/i18n/context";
import {
  DEFAULT_SONG_VOLUME,
  REPEATABLE_SLOTS,
  formatMs,
  parseMs,
  repeatOf,
} from "@/lib/sound/song";

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
  onSave,
}: {
  slot: SoundSlot;
  value: SoundSlotOptions | undefined;
  /** Built-in (synthesized) skin: no timeline, so no start / end points. */
  builtin: boolean;
  onSave: (next: SoundSlotOptions) => void;
}) {
  const t = useT();
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

  const alignable = !builtin && (slot === "countdown" || slot === "question");
  const endAligned = alignable && draft.align === "end";
  const volume = draft.volume ?? DEFAULT_SONG_VOLUME;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-lprimary/5 dark:bg-white/3 p-3 text-sm">
      <label className="flex flex-wrap items-center gap-3">
        <span className="w-40">{t("Volume")}</span>
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

      <div className="flex flex-wrap items-center gap-3">
        <span className="w-40">{t("Fade in at the start")}</span>
        <Switch
          aria-label={t("Fade in at the start")}
          checked={Boolean(draft.fadeIn)}
          onCheckedChange={(on) => change({ fadeIn: on })}
        />
        {draft.fadeIn && (
          <SecondsInput
            label={t("Fade time")}
            value={draft.fadeInSec ?? 2}
            min={0.1}
            max={30}
            onChange={(fadeInSec) => change({ fadeInSec })}
          />
        )}
      </div>

      {REPEATABLE_SLOTS.includes(slot) && !endAligned && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-40">{t("Repeat")}</span>
          <Switch
            aria-label={t("Repeat")}
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
          <span className="w-40">{t("Song starts")}</span>
          <select
            value={draft.align ?? "start"}
            onChange={(e) =>
              change({ align: e.target.value as "start" | "end" })
            }
            className="rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent px-2 py-1"
          >
            <option value="start">{t("At the beginning")}</option>
            <option value="end">
              {slot === "countdown"
                ? t("End − 5 s (the countdown)")
                : t("End − the question's time")}
            </option>
          </select>
        </div>
      )}

      {!builtin && !endAligned && (
        <TimeField
          label={t("Start at")}
          value={draft.startMs ?? 0}
          onChange={(startMs) => change({ startMs })}
        />
      )}

      {endAligned && (
        <>
          <TimeField
            label={t("End point at")}
            value={draft.endMs ?? 0}
            onChange={(endMs) => change({ endMs })}
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-40">{t("Extend by")}</span>
            <SecondsInput
              label={t("Extend by")}
              value={draft.extendSec ?? 0}
              min={0}
              max={5}
              onChange={(extendSec) => change({ extendSec })}
            />
            <span className={clsx("text-xs", mutedText)}>
              {t("The song plays on this long after the end, then fades out.")}
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
}: {
  label: string;
  value: number;
  onChange: (ms: number) => void;
}) {
  const [text, setText] = useState(formatMs(value));
  const valid = parseMs(text) !== null;
  return (
    <label className="flex flex-wrap items-center gap-3">
      <span className="w-40">{label}</span>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const ms = parseMs(e.target.value);
          if (ms !== null) onChange(ms);
        }}
        onBlur={() => valid && setText(formatMs(parseMs(text)!))}
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
