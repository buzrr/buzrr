"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { LuPlay, LuSquare } from "react-icons/lu";
import {
  isQuestionSlot,
  type SoundSlot,
  type SoundSlotOptions,
} from "@buzrr/contract";
import { mutedText } from "@/components/Game/GameUI";
import { useT } from "@/lib/i18n/context";
import { decodePeaks } from "@/lib/sound/peaks";
import { fetchClip } from "@/lib/sound/preload";
import { fadeInOf, formatMs, playSong } from "@/lib/sound/song";
import type { SoundHandle } from "@/lib/sound/synth";

const COUNTDOWN_MS = 5000;
const START_COLOR = "#7c4ddb";
const EXTEND_COLOR = "#e0a020";

/**
 * A skin song's waveform with its cue: the start point, or — end-aligned —
 * the end point with the part that plays before it (the countdown's 5 s or
 * the question's time) and the extend after it. Click sets the cue, drag
 * moves it; the fade-in shows as a ramp. Preview plays it like the game.
 */
export function SongWaveform({
  url,
  slot,
  options,
  onChange,
}: {
  url: string;
  slot: SoundSlot;
  options: SoundSlotOptions;
  onChange: (patch: Partial<SoundSlotOptions>) => void;
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wave, setWave] = useState<{
    peaks: number[];
    durationMs: number;
  } | null>(null);
  const [error, setError] = useState(false);
  // How long the preview question runs (end-aligned question songs).
  const [questionSec, setQuestionSec] = useState(20);
  const preview = useRef<SoundHandle | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let alive = true;
    decodePeaks(url)
      .then((w) => alive && setWave(w))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [url]);
  useEffect(() => () => preview.current?.stop(), []);

  const endAligned = options.align === "end";
  const windowMs =
    slot === "countdown"
      ? COUNTDOWN_MS
      : isQuestionSlot(slot)
        ? questionSec * 1000
        : null;
  const cueMs = endAligned
    ? (options.endMs ?? wave?.durationMs ?? 0)
    : (options.startMs ?? 0);
  const extendMs = endAligned ? (options.extendSec ?? 0) * 1000 : 0;
  const fadeMs = fadeInOf(slot, options) * 1000;

  // The part that plays: [from, to] in the file, plus the extend after it.
  const from = endAligned ? Math.max(0, cueMs - (windowMs ?? 0)) : cueMs;
  const to = endAligned
    ? cueMs
    : windowMs
      ? Math.min(wave?.durationMs ?? 0, cueMs + windowMs)
      : (wave?.durationMs ?? 0);

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
    const xFrom = x(from);
    const xTo = x(to);
    const xExt = x(Math.min(wave.durationMs, to + extendMs));
    ctx.fillStyle = "rgba(124, 77, 219, 0.16)";
    ctx.fillRect(xFrom, 0, xTo - xFrom, h);
    if (extendMs > 0) {
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
    if (fadeMs > 0) {
      // The fade-in: a ramp from silence over its first seconds.
      const xf = x(Math.min(wave.durationMs, from + fadeMs));
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xFrom, h - 2);
      ctx.lineTo(xf, 2);
      ctx.stroke();
    }
    ctx.fillStyle = endAligned ? EXTEND_COLOR : START_COLOR;
    ctx.fillRect(x(cueMs) - 1, 0, 2, h);
  }, [wave, from, to, extendMs, fadeMs, cueMs, endAligned]);

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
    onChange(endAligned ? { endMs: v } : { startMs: v });
  };
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!wave) return;
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

  const togglePreview = () => {
    preview.current?.stop();
    preview.current = null;
    if (playing) {
      setPlaying(false);
      return;
    }
    preview.current = playSong(
      () => fetchClip(url),
      slot,
      options,
      { untilEndMs: windowMs },
      url,
    );
    setPlaying(true);
    if (windowMs) {
      // Stops like the phase would (an end-aligned song plays its extend).
      const handle = preview.current;
      setTimeout(() => {
        handle.stop();
        setPlaying((p) => (preview.current === handle ? false : p));
      }, windowMs);
    }
  };

  if (error) {
    return (
      <p className="text-xs text-red-light dark:text-red-dark">
        {t("Could not read this audio file")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={clsx(
          "w-full h-20 rounded-lg bg-light-bg dark:bg-card-dark touch-none select-none",
          wave ? "cursor-pointer" : "animate-pulse",
        )}
        aria-label={
          endAligned
            ? t("Waveform — click or drag to set the end point")
            : t("Waveform — click or drag to set the start point")
        }
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={mutedText}>
          {endAligned
            ? t("End point {t}", { t: formatMs(cueMs) })
            : t("Start {t}", { t: formatMs(cueMs) })}
          {wave && ` · ${formatMs(wave.durationMs)}`}
        </span>
        {endAligned && isQuestionSlot(slot) && (
          <label className="flex items-center gap-1">
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
        <button
          type="button"
          onClick={togglePreview}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-lprimary/10 dark:bg-white/5 cursor-pointer"
        >
          {playing ? <LuSquare size={12} /> : <LuPlay size={12} />}
          {t("Preview")}
        </button>
      </div>
    </div>
  );
}
