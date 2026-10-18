"use client";
/**
 * Plays a skin's song (an uploaded file) with its slot options: volume,
 * fade-in, repeat, a start point — or, for the countdown and the question,
 * timed so the song's end point falls on the end of the countdown / question
 * and then keeps going `extendSec` seconds.
 *
 * Web Audio (gain ramps work on iOS, where <audio>.volume is read-only); a
 * plain <audio> element is the fallback when the file can't be decoded here.
 */
import {
  isQuestionSlot,
  type SoundSlot,
  type SoundSlotOptions,
} from "@buzrr/contract";
import { audioContext, type SoundHandle } from "./synth";
import { fadeOutAndPause } from "./fade";

/** The usual level when a slot sets no volume (0–100). */
export const DEFAULT_SONG_VOLUME = 80;
const DEFAULT_FADE_IN_SEC = 2;
const STOP_FADE_SEC = 0.4;

/** Slots that offer "repeat" (countdown and tusch play once). */
export const REPEATABLE_SLOTS: readonly SoundSlot[] = [
  "lobby",
  "question",
  "lastQuestion",
  "scores",
  "reveal",
  "final",
];

/** Repeat when the slot doesn't say: only the lobby music loops by default. */
export function repeatOf(slot: SoundSlot, o: SoundSlotOptions | undefined) {
  if (!REPEATABLE_SLOTS.includes(slot)) return false;
  return o?.repeat ?? slot === "lobby";
}

export interface SongTiming {
  /** ms until the countdown / question ends (end-aligned songs). */
  untilEndMs?: number | null;
}

/** "1:05.250" ⇄ 65250 ms. */
export function formatMs(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = (ms % 60000) / 1000;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}
export function parseMs(text: string): number | null {
  const m = /^\s*(?:(\d+):)?(\d+(?:[.,]\d{1,3})?)\s*$/.exec(text);
  if (!m) return null;
  const secs = Number(m[2]!.replace(",", "."));
  const mins = m[1] ? Number(m[1]) : 0;
  if (!Number.isFinite(secs) || (m[1] && secs >= 60)) return null;
  return Math.round((mins * 60 + secs) * 1000);
}

export function playSong(
  load: () => Promise<ArrayBuffer>,
  slot: SoundSlot,
  options: SoundSlotOptions | undefined,
  timing: SongTiming = {},
  /** <audio> fallback source (a plain file URL), if any. */
  fallbackUrl?: string,
): SoundHandle {
  const o = options ?? {};
  const volume = (o.volume ?? DEFAULT_SONG_VOLUME) / 100;
  const ctx = audioContext();
  let stopped = false;
  let stopNow: ((fadeSec?: number) => void) | null = null;
  let stopLater: (() => void) | null = null;
  let fallback: HTMLAudioElement | null = null;
  let endAlignedSong = false;

  const startFallback = () => {
    if (stopped || !fallbackUrl) return;
    const a = new Audio(fallbackUrl);
    a.loop = repeatOf(slot, o);
    a.volume = volume;
    a.currentTime = (o.startMs ?? 0) / 1000;
    void a.play().catch(() => undefined);
    fallback = a;
  };

  if (!ctx) {
    startFallback();
  } else {
    if (ctx.state !== "running") void ctx.resume();
    void load()
      .then((bytes) => ctx.decodeAudioData(bytes.slice(0)))
      .then((buf) => {
        if (stopped) return;
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(gain);
        const now = ctx.currentTime + 0.02;
        const last = Math.max(0, buf.duration - 0.05);
        const at = (ms: number | undefined, fb: number) =>
          Math.min(last, Math.max(0, ms === undefined ? fb : ms / 1000));

        let when = now;
        let offset = at(o.startMs, 0);
        // End-aligned: the end point lands on the countdown's / question's end.
        const until = timing.untilEndMs;
        const endAligned =
          o.align === "end" &&
          (slot === "countdown" || isQuestionSlot(slot)) &&
          typeof until === "number" &&
          until > 0;
        const extend = endAligned ? (o.extendSec ?? 0) : 0;
        let endAt: number | null = null;
        if (endAligned) {
          const endPoint = at(o.endMs, buf.duration);
          offset = endPoint - until / 1000;
          if (offset < 0) {
            // Shorter time left than song before the end point: start later.
            when = now - offset;
            offset = 0;
          }
          endAt = now + until / 1000 + extend;
        } else if (repeatOf(slot, o)) {
          src.loop = true;
          src.loopStart = offset;
          src.loopEnd = buf.duration;
        }

        const fade = o.fadeIn ? (o.fadeInSec ?? DEFAULT_FADE_IN_SEC) : 0;
        gain.gain.setValueAtTime(fade > 0 ? 0.0001 : volume, now);
        if (fade > 0) {
          gain.gain.setValueAtTime(0.0001, when);
          gain.gain.linearRampToValueAtTime(volume, when + fade);
        }
        src.start(when, offset);

        const fadeOutAt = (t: number, fadeSec = STOP_FADE_SEC) => {
          const from = Math.max(t, ctx.currentTime);
          // Scheduled ahead: the level it will have then (the fade-in is over).
          const level =
            from > ctx.currentTime + 0.05 ? volume : gain.gain.value;
          gain.gain.cancelScheduledValues(from);
          gain.gain.setValueAtTime(level, from);
          gain.gain.linearRampToValueAtTime(0.0001, from + fadeSec);
          try {
            src.stop(from + fadeSec + 0.05);
          } catch {
            // already stopped
          }
          setTimeout(
            () => gain.disconnect(),
            (from - ctx.currentTime + fadeSec + 0.2) * 1000,
          );
        };
        stopNow = (fadeSec?: number) => fadeOutAt(ctx.currentTime, fadeSec);
        // An end-aligned song plays on `extendSec` after the phase ends.
        endAlignedSong = endAligned;
        stopLater = () =>
          fadeOutAt(Math.min(endAt ?? Infinity, ctx.currentTime + extend));
        if (endAt !== null) fadeOutAt(endAt);
      })
      .catch(startFallback);
  }

  return {
    stop: (fadeSec?: number) => {
      if (stopped) return;
      stopped = true;
      if (fallback)
        fadeOutAndPause(fallback, (fadeSec ?? STOP_FADE_SEC) * 1000);
      // An end-aligned song keeps its extend; any other fades out now.
      if (stopLater && endAlignedSong) stopLater();
      else stopNow?.(fadeSec);
    },
  };
}
