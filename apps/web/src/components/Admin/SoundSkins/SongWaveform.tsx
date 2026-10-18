"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  isCountdownSlot,
  isCueSlot,
  isQuestionSlot,
  type SoundSlot,
  type SoundSlotOptions,
} from "@buzrr/contract";
import { mutedText } from "@/components/Game/GameUI";
import { useT } from "@/lib/i18n/context";
import { builtinPeaks, decodePeaks, type Wave } from "@/lib/sound/peaks";
import { fadeInOf, formatMs, headAt, type Timeline } from "@/lib/sound/song";
import type { BuiltinSkinId } from "@/lib/sound/synth";

const COUNTDOWN_MS = 5000;
const START_COLOR = "#7c4ddb";
const EXTEND_COLOR = "#e0a020";
/** Wall clock (read in callbacks only). */
const clockMs = () => Date.now();

/** Where a waveform comes from: an uploaded file, or a built-in skin's synth. */
export type WaveSource = { url: string } | { skinId: BuiltinSkinId };

/** The part of the file a slot plays around its cue, for drawing / counting. */
export function cueLayout(
  slot: SoundSlot,
  options: SoundSlotOptions,
  durationMs: number,
  questionMs: number,
) {
  // The tusch: its zero point lands on the question's end; the lead-in
  // before it plays while the question runs, the rest after it.
  const tusch = slot === "end";
  const endAligned = tusch || options.align === "end";
  const windowMs = tusch
    ? (options.endMs ?? 0)
    : isCountdownSlot(slot)
      ? COUNTDOWN_MS
      : isQuestionSlot(slot)
        ? questionMs
        : null;
  const cueMs = tusch
    ? (options.endMs ?? 0)
    : endAligned
      ? (options.endMs ?? durationMs)
      : (options.startMs ?? 0);
  const extendMs = tusch
    ? Math.max(0, durationMs - cueMs)
    : endAligned
      ? (options.extendSec ?? 0) * 1000
      : 0;
  const from = endAligned ? Math.max(0, cueMs - (windowMs ?? 0)) : cueMs;
  const to = endAligned
    ? cueMs
    : windowMs
      ? Math.min(durationMs, cueMs + windowMs)
      : durationMs;
  return { tusch, endAligned, windowMs, cueMs, extendMs, from, to };
}

/**
 * A slot's waveform: the part that plays (purple), the extend / the tusch's
 * rest (orange), the fade-in ramp, its cue line, and a playhead while it
 * plays (with a counter: −20 … 0 … +x.x s around an end / zero point).
 * With `onChange`, click / drag sets the cue (start, end or zero point).
 */
export function SongWaveform({
  source,
  slot,
  options,
  questionMs = 20_000,
  timeline,
  onChange,
  onPastEnd,
}: {
  source: WaveSource;
  slot: SoundSlot;
  options: SoundSlotOptions;
  /** The question's time the window is drawn for. */
  questionMs?: number;
  /** The playing sound, if any. */
  timeline?: Timeline | null;
  onChange?: (patch: Partial<SoundSlotOptions>) => void;
  /** A sound that doesn't repeat ran past the file's end. */
  onPastEnd?: () => void;
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wave, setWave] = useState<Wave | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  const sourceKey = "url" in source ? source.url : `${source.skinId}:${slot}`;

  useEffect(() => {
    let alive = true;
    const load =
      "url" in source
        ? decodePeaks(source.url)
        : builtinPeaks(source.skinId, slot);
    load
      .then((w) => {
        if (!alive) return;
        if (w) setWave(w);
        else setError(true);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- by source only
  }, [sourceKey]);

  // Tick while playing (playhead, counter).
  useEffect(() => {
    if (!timeline) return;
    const tick = setInterval(() => setNow(clockMs()), 50);
    return () => clearInterval(tick);
  }, [timeline]);

  // Built-in skins have no cue points: the whole render is "what plays".
  const timed = "url" in source && !isCueSlot(slot);
  const editable = Boolean(onChange) && timed;
  const layout = cueLayout(slot, options, wave?.durationMs ?? 0, questionMs);
  const { endAligned, windowMs, cueMs, extendMs, from, to } = layout;
  const fadeMs = fadeInOf(slot, options) * 1000;
  const head = timeline && now ? headAt(timeline, now) : null;
  const pastEnd =
    head !== null &&
    wave !== null &&
    !timeline?.loop &&
    head > wave.durationMs + 300;
  useEffect(() => {
    if (pastEnd) onPastEnd?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pastEnd]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !wave) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const x = (ms: number) => (ms / wave.durationMs) * w;
    const pFrom = timed ? from : 0;
    const pTo = timed ? to : wave.durationMs;
    const pExt = timed ? Math.min(wave.durationMs, to + extendMs) : pTo;
    const xFrom = x(pFrom);
    const xTo = x(pTo);
    const xExt = x(pExt);
    ctx.fillStyle = "rgba(124, 77, 219, 0.16)";
    ctx.fillRect(xFrom, 0, xTo - xFrom, h);
    if (xExt > xTo) {
      ctx.fillStyle = "rgba(224, 160, 32, 0.18)";
      ctx.fillRect(xTo, 0, xExt - xTo, h);
    }
    const barW = w / wave.peaks.length;
    wave.peaks.forEach((p, i) => {
      const bx = i * barW;
      const bh = Math.max(1, p * (h - 6));
      ctx.fillStyle =
        bx >= xFrom && bx <= xTo
          ? START_COLOR
          : bx > xTo && bx <= xExt
            ? EXTEND_COLOR
            : "rgba(138, 136, 150, 0.6)";
      ctx.fillRect(bx, (h - bh) / 2, Math.max(1, barW - 0.5), bh);
    });
    if (fadeMs > 0 && !isCueSlot(slot)) {
      const xf = x(Math.min(wave.durationMs, pFrom + fadeMs));
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xFrom, h - 2);
      ctx.lineTo(xf, 2);
      ctx.stroke();
    }
    if (timed) {
      ctx.fillStyle = endAligned ? EXTEND_COLOR : START_COLOR;
      ctx.fillRect(x(cueMs) - 1, 0, 2, h);
    }
    if (head !== null && head >= 0 && head <= wave.durationMs) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fillRect(x(head) - 1, 0, 2, h);
    }
  }, [wave, from, to, extendMs, fadeMs, cueMs, endAligned, head, timed, slot]);

  const dragging = useRef(false);
  const msAt = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return (
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) *
      (wave?.durationMs ?? 0)
    );
  };
  const place = (ms: number) => {
    const v = Math.round(Math.max(0, Math.min(wave?.durationMs ?? 0, ms)));
    onChange?.(endAligned ? { endMs: v } : { startMs: v });
  };
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!wave || !editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    place(msAt(e));
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (dragging.current) place(msAt(e));
  };
  const endDrag = () => {
    dragging.current = false;
  };

  // Counter around the end / zero point (end-aligned and the tusch), else
  // the time since it started.
  let counter: string | null = null;
  let afterZero = false;
  if (timeline && now) {
    if (endAligned && windowMs && timed) {
      const zeroWall = timeline.startWall + (cueMs - timeline.fileStartMs);
      const d = now - zeroWall;
      afterZero = d >= 0;
      counter =
        d < 0 ? `−${Math.ceil(-d / 1000)}` : `+${(d / 1000).toFixed(1)} s`;
    } else {
      counter = `${(Math.max(0, now - timeline.startWall) / 1000).toFixed(1)} s`;
    }
  }

  if (error) {
    return (
      <p className="text-xs text-red-light dark:text-red-dark">
        {t("Could not read this audio file")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={clsx(
          "w-full h-20 rounded-lg bg-light-bg dark:bg-card-dark touch-none select-none",
          !wave ? "animate-pulse" : editable ? "cursor-pointer" : "",
        )}
        aria-label={
          !editable
            ? t("Waveform")
            : endAligned
              ? t("Waveform — click or drag to set the end point")
              : t("Waveform — click or drag to set the start point")
        }
      />
      <div
        className={clsx("flex flex-wrap items-center gap-2 text-xs", mutedText)}
      >
        {timed && (
          <span>
            {endAligned
              ? t("End point {t}", { t: formatMs(cueMs) })
              : t("Start {t}", { t: formatMs(cueMs) })}
          </span>
        )}
        {wave && <span>{formatMs(wave.durationMs)}</span>}
        {counter && (
          <span
            className={clsx(
              "ml-auto tabular-nums font-bold text-sm",
              afterZero ? "text-[#e0a020]" : "text-dark dark:text-white",
            )}
          >
            {counter}
          </span>
        )}
      </div>
    </div>
  );
}
