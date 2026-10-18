"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LuChevronDown, LuPlay, LuSquare } from "react-icons/lu";
import {
  isQuestionSlot,
  type SoundSlot,
  type SoundSlotOptions,
} from "@buzrr/contract";
import { useT } from "@/lib/i18n/context";
import type { Timeline } from "@/lib/sound/song";
import { audioContext, type SoundHandle } from "@/lib/sound/synth";
import { SongWaveform, type WaveSource } from "./SongWaveform";
import { SlotOptionsEditor } from "./SlotOptionsEditor";

/** Starts a slot's sound; reports where it plays through `onTimeline`. */
export type SlotStarter = (
  onTimeline: (tl: Timeline) => void,
) => SoundHandle | null;

interface Playing {
  handle: SoundHandle;
  timeline: Timeline | null;
}

/**
 * What one skin card plays: per slot a handle and its timeline (playheads),
 * and which slots are open. Playing a slot opens it; the test bench plays
 * several at once through `start` with `solo` off.
 */
export function usePlayback() {
  const [playing, setPlaying] = useState<Partial<Record<SoundSlot, Playing>>>(
    {},
  );
  const [open, setOpen] = useState<Set<SoundSlot>>(new Set());
  const live = useRef(playing);
  useEffect(() => {
    live.current = playing;
  });
  useEffect(
    () => () => Object.values(live.current).forEach((p) => p?.handle.stop()),
    [],
  );

  const forget = (slot: SoundSlot, handle: SoundHandle) =>
    setPlaying((p) => {
      if (p[slot]?.handle !== handle) return p;
      const next = { ...p };
      delete next[slot];
      return next;
    });

  /** Play `slot`; `solo` stops everything else first (a preview). */
  const start = (
    slot: SoundSlot,
    starter: SlotStarter,
    solo = true,
  ): SoundHandle | null => {
    void audioContext()?.resume();
    if (solo) stopAll();
    else live.current[slot]?.handle.stop();
    let handle: SoundHandle | null = null;
    // A synth reports its timeline at once, a file once decoded.
    let early: Timeline | null = null;
    const inner = starter((tl) => {
      if (!handle) {
        early = tl;
        return;
      }
      const h = handle;
      setPlaying((p) =>
        p[slot]?.handle === h
          ? { ...p, [slot]: { handle: h, timeline: tl } }
          : p,
      );
    });
    if (!inner) return null;
    handle = {
      stop: (fadeSec?: number) => {
        inner.stop(fadeSec);
        forget(slot, handle!);
      },
    };
    const h = handle;
    setPlaying((p) => ({ ...p, [slot]: { handle: h, timeline: early } }));
    setOpen((o) => new Set(o).add(slot));
    return handle;
  };
  const stop = (slot: SoundSlot) => live.current[slot]?.handle.stop();
  const stopAll = () =>
    Object.values(live.current).forEach((p) => p?.handle.stop());
  const toggleOpen = (slot: SoundSlot) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  /** The sound ran out by itself: drop its playhead. */
  const ended = (slot: SoundSlot) =>
    setPlaying((p) => {
      if (!p[slot]) return p;
      const next = { ...p };
      delete next[slot];
      return next;
    });

  return { playing, open, start, stop, stopAll, toggleOpen, ended };
}
export type Playback = ReturnType<typeof usePlayback>;

/**
 * One slot of a skin, the same for built-in and user skins: label, the
 * row's own controls (upload, source, …), Play / Stop and a chevron. Open:
 * the waveform with its playhead, and the options when they can be edited.
 */
export function SlotRow({
  slot,
  label,
  playback,
  starter,
  wave,
  options,
  editable,
  builtin,
  onSave,
  controls,
}: {
  slot: SoundSlot;
  label: string;
  playback: Playback;
  /** Plays it like the game (null: nothing to play here). */
  starter: ((questionMs: number) => SlotStarter) | null;
  /** The waveform to show (null: no sound here). */
  wave: WaveSource | null;
  options: SoundSlotOptions | undefined;
  /** The options can be changed (own skin, or the superadmin on built-ins). */
  editable: boolean;
  builtin: boolean;
  onSave: (next: SoundSlotOptions) => void;
  /** Upload / replace / remove / source picker. */
  controls?: ReactNode;
}) {
  const t = useT();
  const now = playback.playing[slot];
  const isOpen = playback.open.has(slot);
  // End-aligned question music: preview it for this long a question.
  const [questionSec, setQuestionSec] = useState(20);
  const questionMs = questionSec * 1000;
  const showQuestionTime =
    !builtin && isQuestionSlot(slot) && options?.align === "end";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="w-64 max-w-full">{label}</span>
        {controls}
        {starter && (
          <button
            type="button"
            onClick={() =>
              now
                ? playback.stop(slot)
                : playback.start(slot, starter(questionMs))
            }
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold bg-lprimary/10 dark:bg-white/5 cursor-pointer"
          >
            {now ? <LuSquare size={11} /> : <LuPlay size={11} />}
            {now ? t("Stop") : t("Play")}
          </button>
        )}
        {wave && (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label={t("Options")}
            onClick={() => playback.toggleOpen(slot)}
            className={clsx(
              "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold cursor-pointer",
              isOpen ? "bg-dprimary/20" : "bg-lprimary/10 dark:bg-white/5",
            )}
          >
            <LuChevronDown
              size={12}
              className={clsx("transition-transform", isOpen && "rotate-180")}
            />
            {t("Options")}
          </button>
        )}
      </div>
      {isOpen && wave && (
        <div className="flex flex-col gap-1.5">
          {showQuestionTime && (
            <label className="flex items-center gap-1 text-xs">
              {t("Preview question time")}
              <input
                type="number"
                min={3}
                max={300}
                value={questionSec}
                onChange={(e) =>
                  setQuestionSec(
                    Math.min(300, Math.max(3, Number(e.target.value) || 3)),
                  )
                }
                className="w-16 rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent px-1.5 py-0.5 tabular-nums"
              />
              s
            </label>
          )}
          {editable ? (
            <SlotOptionsEditor
              slot={slot}
              builtin={builtin}
              wave={wave}
              value={options}
              timeline={now?.timeline}
              questionMs={questionMs}
              onPastEnd={() => playback.ended(slot)}
              onSave={onSave}
            />
          ) : (
            <SongWaveform
              source={wave}
              slot={slot}
              options={options ?? {}}
              questionMs={questionMs}
              timeline={now?.timeline}
              onPastEnd={() => playback.ended(slot)}
            />
          )}
        </div>
      )}
    </div>
  );
}
