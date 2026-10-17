"use client";

import { useEffect } from "react";

/**
 * Plays `url` from `startMs` for `durationMs` (or until the caller unmounts
 * when `durationMs` is null). One element per call; stopping fades out
 * briefly so a cut-off doesn't click. Returns a stop function.
 */
export function playSegment(
  url: string,
  startMs: number,
  durationMs: number | null,
): () => void {
  const audio = new Audio(url);
  audio.preload = "auto";
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fade: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    // Short fade-out, then pause.
    fade = setInterval(() => {
      audio.volume = Math.max(0, audio.volume - 0.15);
      if (audio.volume <= 0.01) {
        if (fade) clearInterval(fade);
        audio.pause();
      }
    }, 40);
  };

  const start = () => {
    if (stopped) return;
    audio.currentTime = startMs / 1000;
    void audio.play().catch(() => {
      // Autoplay refused (no user gesture yet) — nothing to do; the host's
      // clicks (start game / next) normally unlock audio for the page.
    });
    if (durationMs !== null) timer = setTimeout(stop, durationMs);
  };

  if (audio.readyState >= 1) start();
  else audio.addEventListener("loadedmetadata", start, { once: true });

  return () => {
    stop();
    audio.removeEventListener("loadedmetadata", start);
  };
}

/** Hook form of `playSegment`: plays while mounted (and `url` is set). */
export function useAudioSegment(
  url: string | null | undefined,
  startMs: number | null | undefined,
  durationMs: number | null,
  /** Restart when this changes (e.g. the question id). */
  key: string | number | undefined,
) {
  useEffect(() => {
    if (!url || startMs === null || startMs === undefined) return;
    return playSegment(url, startMs, durationMs);
  }, [url, startMs, durationMs, key]);
}
