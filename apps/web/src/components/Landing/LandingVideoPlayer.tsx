"use client";

import { useEffect, useRef } from "react";

/**
 * Autoplays while at least half the video is on screen; pauses when it leaves.
 * Nothing downloads until it first plays (`preload="none"` + poster).
 *
 * Sound is on by default, but browsers refuse unmuted autoplay until the
 * visitor has clicked or pressed a key on the page (scrolling doesn't count).
 * When refused, it plays muted and unmutes on the first click/key press
 * anywhere — unless the visitor muted it themselves.
 *
 * A manual pause or the end of the video is respected — scrolling back won't
 * restart it. Reduced-motion users get no autoplay.
 */
export default function LandingVideoPlayer({
  src,
  poster,
}: {
  src: string;
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = 0.4;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let inView = false;
    let userPaused = false;
    let autoPausing = false;
    // Muted by us because the browser blocked sound, not by the visitor.
    let forcedMuted = false;

    const play = () => {
      video.play().catch((err: unknown) => {
        const blocked =
          err instanceof DOMException && err.name === "NotAllowedError";
        if (!blocked || video.muted || !inView) return;
        video.muted = true;
        forcedMuted = true;
        video.play().catch(() => {});
      });
    };

    const onPlay = () => {
      userPaused = false;
    };
    const onPause = () => {
      if (!autoPausing) userPaused = true;
      autoPausing = false;
    };
    const onVolumeChange = () => {
      if (!video.muted) forcedMuted = false;
    };
    // Clicks on the video itself go to its controls, which handle sound.
    const onUserActivation = (e: Event) => {
      if (!forcedMuted || e.target === video) return;
      video.muted = false;
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolumeChange);
    document.addEventListener("pointerdown", onUserActivation, true);
    document.addEventListener("keydown", onUserActivation, true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        if (inView) {
          if (!userPaused && !reducedMotion && video.paused) play();
        } else if (!video.paused) {
          autoPausing = true;
          video.pause();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(video);

    return () => {
      observer.disconnect();
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolumeChange);
      document.removeEventListener("pointerdown", onUserActivation, true);
      document.removeEventListener("keydown", onUserActivation, true);
    };
  }, []);

  return (
    <div className="aspect-video overflow-hidden rounded-2xl border border-card-light dark:border-off-dark">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload="none"
        playsInline
        controls
        controlsList="nodownload"
        aria-label="Buzrr product video"
        className="block size-full object-cover"
      />
    </div>
  );
}
