"use client";

import { useEffect } from "react";
import { decryptClipBuffer, fetchClip } from "@/lib/sound/preload";
import { audioContext } from "@/lib/sound/synth";
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
 * Plays decoded audio bytes through the page's AudioContext. Unlike a fresh
 * <audio> element this needs no user gesture of its own once the context
 * runs (Safari blocks `play()` on new elements outside a gesture — a
 * question that opens by itself after the countdown stayed silent).
 */
async function playBuffer(
  bytes: ArrayBuffer,
  startMs: number,
  durationMs: number | null,
  isCancelled: () => boolean,
): Promise<(() => void) | null> {
  const ctx = audioContext();
  if (!ctx) return null;
  if (ctx.state !== "running") void ctx.resume();
  const decoded = await ctx.decodeAudioData(bytes.slice(0));
  if (isCancelled()) return () => undefined;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = decoded;
  src.connect(gain).connect(ctx.destination);
  const offset = Math.min(startMs / 1000, Math.max(0, decoded.duration - 0.05));
  if (durationMs !== null) src.start(0, offset, durationMs / 1000);
  else src.start(0, offset);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
    try {
      src.stop(now + 0.35);
    } catch {
      // already ended
    }
  };
}

/**
 * Hook form: plays while mounted (and `url` is set). With `decryptKey` the
 * URL is an encrypted clip (possibly preloaded already), decrypted in the
 * browser. Played through Web Audio; a plain <audio> is the fallback.
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
    let stop: (() => void) | null = null;
    let cancelled = false;
    const isCancelled = () => cancelled;
    (async () => {
      let bytes: ArrayBuffer;
      try {
        bytes = decryptKey
          ? await decryptClipBuffer(url, decryptKey)
          : await fetchClip(url);
      } catch {
        // A plain file we can't fetch (e.g. another site without CORS):
        // the <audio> element can still play it.
        if (!decryptKey && !cancelled) {
          stop = playSegment(url, startMs, durationMs);
        }
        return;
      }
      if (cancelled) return;
      const s = await playBuffer(bytes, startMs, durationMs, isCancelled).catch(
        () => null,
      );
      if (cancelled) {
        s?.();
        return;
      }
      if (s) {
        stop = s;
        return;
      }
      // No Web Audio (or undecodable here): an <audio> element.
      const objectUrl = URL.createObjectURL(
        new Blob([bytes], { type: "audio/mpeg" }),
      );
      const st = playSegment(objectUrl, startMs, durationMs);
      stop = () => {
        st();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      };
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [url, startMs, durationMs, key, decryptKey]);
}
