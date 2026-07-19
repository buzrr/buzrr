"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IoVolumeHigh, IoVolumeMute } from "react-icons/io5";
import { useAppSelector } from "@/state/hooks";
import { IconButton } from "@/components/ui/IconButton";

const MUTE_KEY = "buzrr:duel-audio-muted";

export type DuelOutcome = "win" | "defeat" | "tie";

/**
 * Browsers block autoplay before the first user gesture — if play() is
 * rejected, retry once on the next pointer/key interaction, but only while
 * the caller still wants this element playing.
 */
function playWhenAllowed(audio: HTMLAudioElement, shouldPlay: () => boolean) {
  audio.play().catch(() => {
    const retry = () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      if (shouldPlay()) audio.play().catch(() => {});
    };
    window.addEventListener("pointerdown", retry, { once: true });
    window.addEventListener("keydown", retry, { once: true });
  });
}

/**
 * Duel soundtrack: looping battle music while the duel is live, then a
 * one-shot win/defeat/tie sting when it ends. Also renders the mute toggle
 * pinned to the top-left corner; the preference persists across duels and
 * defaults to unmuted.
 */
export default function DuelAudio({
  outcome,
}: {
  outcome: DuelOutcome | null;
}) {
  const phase = useAppSelector((state) => state.game.phase);
  const [muted, setMuted] = useState(false);
  const battleRef = useRef<HTMLAudioElement | null>(null);
  const outcomeRef = useRef<HTMLAudioElement | null>(null);
  const inBattleRef = useRef(false);
  const outcomePlayedRef = useRef(false);
  // Guards the gesture-retry in playWhenAllowed: a queued retry must not
  // restart audio after this component unmounts.
  const isMountedRef = useRef(true);

  const inBattle =
    phase === "lobby" ||
    phase === "starting" ||
    phase === "question" ||
    phase === "reveal";
  inBattleRef.current = inBattle;

  useEffect(() => {
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      // Storage unavailable — stay unmuted.
    }
  }, []);

  useEffect(() => {
    if (battleRef.current) battleRef.current.muted = muted;
    if (outcomeRef.current) outcomeRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (inBattle) {
      if (!battleRef.current) {
        const audio = new Audio("/audio/1v1-battle.mp3");
        audio.loop = true;
        battleRef.current = audio;
      }
      battleRef.current.muted = muted;
      playWhenAllowed(
        battleRef.current,
        () => isMountedRef.current && inBattleRef.current,
      );
    } else {
      battleRef.current?.pause();
    }
  }, [inBattle, muted]);

  useEffect(() => {
    if (
      (phase === "final" || phase === "ended") &&
      outcome &&
      !outcomePlayedRef.current
    ) {
      outcomePlayedRef.current = true;
      const audio = new Audio(`/audio/1v1-${outcome}.mp3`);
      audio.muted = muted;
      outcomeRef.current = audio;
      playWhenAllowed(
        audio,
        () => isMountedRef.current && !inBattleRef.current,
      );
    }
  }, [phase, outcome, muted]);

  // Stop everything when leaving the duel screen.
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      battleRef.current?.pause();
      outcomeRef.current?.pause();
    };
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        // Non-fatal: the toggle still works for this session.
      }
      return next;
    });
  }, []);

  return (
    <div className="fixed top-3 left-3 z-40">
      <IconButton
        aria-label={muted ? "Unmute duel audio" : "Mute duel audio"}
        className="bg-white dark:bg-dark text-dark dark:text-white rounded-full p-2 shadow border border-card-light dark:border-off-dark"
        onClick={toggleMute}
        icon={muted ? <IoVolumeMute size={20} /> : <IoVolumeHigh size={20} />}
      />
    </div>
  );
}
