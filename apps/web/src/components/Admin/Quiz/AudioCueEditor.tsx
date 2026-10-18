"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { LuPlay, LuSquare, LuTrash2 } from "react-icons/lu";
import { playSegment } from "@/lib/audio-cues";
import { decodePeaks } from "@/lib/sound/peaks";
import { useT } from "@/lib/i18n/context";
import { mutedText, subtleCardClass } from "@/components/Game/GameUI";

const REVEAL_PREVIEW_MS = 10_000;
/** A moved reveal cue: this pause, then its part plays from the new spot. */
const REVEAL_RESTART_PAUSE_MS = 500;

function formatMs(ms: number) {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
}

/**
 * The question's sound: waveform with the window that plays while the
 * question is open (from the start cue, as long as the question's time) and
 * the reveal cue. Clicking the waveform sets whichever cue is selected.
 */
export default function AudioCueEditor({
  src,
  name,
  questionMs,
  startMs,
  revealMs,
  onChange,
  onRemove,
}: {
  src: string;
  name: string;
  /** The question's answer time — how long the question window plays. */
  questionMs: number;
  startMs: number;
  revealMs: number | null;
  onChange: (cues: { startMs: number; revealMs: number | null }) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wave, setWave] = useState<{
    peaks: number[];
    durationMs: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"start" | "reveal">("start");
  const stopRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState<"question" | "reveal" | null>(null);

  useEffect(() => {
    let alive = true;
    decodePeaks(src)
      .then((w) => {
        if (!alive) return;
        setWave(w);
        setError(null);
      })
      .catch(() => {
        if (alive) setError(t("Could not read this audio file"));
      });
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => () => stopRef.current?.(), []);

  // The reveal cue moved while its part plays: stop, a short pause, then
  // play from the new spot (after the last move while dragging).
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  });
  const restart = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReveal = useRef(revealMs);
  useEffect(() => {
    if (lastReveal.current === revealMs) return;
    lastReveal.current = revealMs;
    if (playingRef.current !== "reveal" || revealMs === null) return;
    stopRef.current?.();
    stopRef.current = null;
    if (restart.current) clearTimeout(restart.current);
    restart.current = setTimeout(() => {
      if (playingRef.current !== "reveal") return;
      stopRef.current = playSegment(src, revealMs, REVEAL_PREVIEW_MS);
    }, REVEAL_RESTART_PAUSE_MS);
  }, [revealMs, src]);
  useEffect(
    () => () => {
      if (restart.current) clearTimeout(restart.current);
    },
    [],
  );

  // Draw: bars, the question window, and the reveal cue.
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
    const winFrom = x(startMs);
    const winTo = x(Math.min(wave.durationMs, startMs + questionMs));
    ctx.fillStyle = "rgba(124, 77, 219, 0.16)";
    ctx.fillRect(winFrom, 0, winTo - winFrom, h);
    const barW = w / wave.peaks.length;
    wave.peaks.forEach((p, i) => {
      const bx = i * barW;
      const bh = Math.max(1, p * (h - 6));
      ctx.fillStyle =
        bx >= winFrom && bx <= winTo ? "#7c4ddb" : "rgba(138, 136, 150, 0.6)";
      ctx.fillRect(bx, (h - bh) / 2, Math.max(1, barW - 0.5), bh);
    });
    ctx.fillStyle = "#7c4ddb";
    ctx.fillRect(winFrom - 1, 0, 2, h);
    if (revealMs !== null) {
      // The reveal part (as previewed), tinted, with its cue line.
      const rFrom = x(revealMs);
      const rTo = x(Math.min(wave.durationMs, revealMs + REVEAL_PREVIEW_MS));
      ctx.fillStyle = "rgba(224, 160, 32, 0.16)";
      ctx.fillRect(rFrom, 0, rTo - rFrom, h);
      ctx.fillStyle = "#e0a020";
      ctx.fillRect(rFrom - 1, 0, 2, h);
    }
  }, [wave, startMs, revealMs, questionMs]);

  // Drag: grabbing inside the question window (or the reveal part) moves
  // it — and switches to that cue, whichever was selected. Elsewhere a press
  // puts the selected cue there and keeps dragging it.
  const drag = useRef<{ cue: "start" | "reveal"; offsetMs: number } | null>(
    null,
  );
  const msAt = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return (
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) *
      (wave?.durationMs ?? 0)
    );
  };
  const place = (cue: "start" | "reveal", ms: number) => {
    if (!wave) return;
    const max =
      cue === "start"
        ? Math.max(0, wave.durationMs - Math.min(questionMs, wave.durationMs))
        : wave.durationMs;
    const v = Math.round(Math.max(0, Math.min(max, ms)));
    if (cue === "start") onChange({ startMs: v, revealMs });
    else onChange({ startMs, revealMs: v });
  };
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!wave) return;
    const ms = msAt(e);
    const inStart = ms >= startMs && ms <= startMs + questionMs;
    const inReveal =
      revealMs !== null && ms >= revealMs && ms <= revealMs + REVEAL_PREVIEW_MS;
    // Both overlap: the selected cue wins.
    const cue: "start" | "reveal" | null =
      inStart && inReveal
        ? mode
        : inStart
          ? "start"
          : inReveal
            ? "reveal"
            : null;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (cue) {
      if (cue !== mode) setMode(cue);
      drag.current = {
        cue,
        offsetMs: ms - (cue === "start" ? startMs : revealMs!),
      };
      return;
    }
    drag.current = { cue: mode, offsetMs: 0 };
    place(mode, ms);
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || !wave) return;
    place(d.cue, msAt(e) - d.offsetMs);
  };
  const endDrag = () => {
    drag.current = null;
  };

  const preview = (which: "question" | "reveal") => {
    stopRef.current?.();
    if (playing === which) {
      setPlaying(null);
      return;
    }
    const from = which === "question" ? startMs : (revealMs ?? 0);
    const length = which === "question" ? questionMs : REVEAL_PREVIEW_MS;
    stopRef.current = playSegment(src, from, length);
    setPlaying(which);
    setTimeout(() => setPlaying((p) => (p === which ? null : p)), length);
  };

  const modeButton = (m: "start" | "reveal", label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={clsx(
        "px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer",
        mode === m
          ? m === "start"
            ? "bg-[#7c4ddb] text-white"
            : "bg-[#e0a020] text-[#2a1d00]"
          : "bg-lprimary/8 dark:bg-white/5",
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      className={clsx("flex flex-col gap-2 rounded-2xl p-2.5", subtleCardClass)}
    >
      <div className="flex items-center gap-2">
        <span className={clsx("flex-1 min-w-0 truncate text-sm", mutedText)}>
          {name}
          {wave && ` · ${formatMs(wave.durationMs)}`}
        </span>
        <button
          type="button"
          aria-label={t("Remove sound")}
          onClick={() => {
            stopRef.current?.();
            onRemove();
          }}
          className="size-9 shrink-0 rounded-[10px] flex items-center justify-center text-off-dark dark:text-muted-dark hover:bg-[#e5544e]/14 hover:text-[#e5544e] transition-colors cursor-pointer"
        >
          <LuTrash2 size={17} />
        </button>
      </div>
      {error ? (
        <p className="text-xs text-red-light dark:text-red-dark">{error}</p>
      ) : (
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={clsx(
            "w-full h-20 rounded-lg bg-light-bg dark:bg-card-dark touch-none select-none",
            wave ? "cursor-grab active:cursor-grabbing" : "animate-pulse",
          )}
          aria-label={t(
            "Waveform — drag the highlighted parts, or click to place the selected cue",
          )}
        />
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={mutedText}>{t("Click sets · drag moves:")}</span>
        {modeButton("start", `Start ${formatMs(startMs)}`)}
        {modeButton(
          "reveal",
          revealMs === null
            ? t("Reveal cue (off)")
            : `Reveal ${formatMs(revealMs)}`,
        )}
        {revealMs !== null && (
          <button
            type="button"
            onClick={() => onChange({ startMs, revealMs: null })}
            className="underline cursor-pointer"
          >
            {t("no reveal sound")}
          </button>
        )}
        <span className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => preview("question")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-lprimary/10 dark:bg-white/5 cursor-pointer"
          >
            {playing === "question" ? (
              <LuSquare size={12} />
            ) : (
              <LuPlay size={12} />
            )}
            {t("Question")}
          </button>
          {revealMs !== null && (
            <button
              type="button"
              onClick={() => preview("reveal")}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-lprimary/10 dark:bg-white/5 cursor-pointer"
            >
              {playing === "reveal" ? (
                <LuSquare size={12} />
              ) : (
                <LuPlay size={12} />
              )}
              {t("Reveal")}
            </button>
          )}
        </span>
      </div>
      <p className={clsx("text-[11.5px]", mutedText)}>
        {t(
          "The highlighted part plays on your screen while the question is open (as long as its time); the reveal cue plays when the answer is shown.",
        )}
      </p>
    </div>
  );
}
