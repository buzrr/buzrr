"use client";

import { useEffect } from "react";
import { decryptClip } from "@/lib/sound/preload";
import { fadeOutAndPause } from "@/lib/sound/fade";

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

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    // Short fade-out, then pause (the pause doesn't wait on the fade: iOS
    // ignores volume changes).
    fadeOutAndPause(audio);
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

/**
 * Hook form of `playSegment`: plays while mounted (and `url` is set). With
 * `decryptKey` the URL is an encrypted clip (possibly preloaded already):
 * it is decrypted in the browser, then played.
 */
export function useAudioSegment(
  url: string | null | undefined,
  startMs: number | null | undefined,
  durationMs: number | null,
  /** Restart when this changes (e.g. the question id). */
  key: string | number | undefined,
  decryptKey?: string | null,
) {
  useEffect(() => {
    if (!url || startMs === null || startMs === undefined) return;
    if (!decryptKey) return playSegment(url, startMs, durationMs);
    let stop: (() => void) | null = null;
    let cancelled = false;
    let objectUrl: string | null = null;
    decryptClip(url, decryptKey)
      .then((u) => {
        objectUrl = u;
        if (!cancelled) stop = playSegment(u, startMs, durationMs);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
      // Let the fade-out finish before the data goes away.
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl!), 1000);
    };
  }, [url, startMs, durationMs, key, decryptKey]);
}
