"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { LuVolume2, LuVolumeX } from "react-icons/lu";
import {
  quizSettingsSchema,
  type QuestionAudio,
  type SoundSettings,
} from "@buzrr/contract";
import { useAppSelector } from "@/state/hooks";
import { audioContext } from "./audio-context";
import { preloadAll, preloadClips } from "./preload";

/**
 * Question sounds for the host's screen and the players' devices: the quiz's
 * sound settings decide where (host / players / both / off) and whether
 * players may switch sound on themselves.
 */

type Role = "host" | "player";

const MUTE_KEY = (role: Role) => `buzrr:sound-${role}`;

function readPref(role: Role): boolean | null {
  try {
    const v = window.localStorage.getItem(MUTE_KEY(role));
    return v === null ? null : v === "on";
  } catch {
    return null;
  }
}

function writePref(role: Role, on: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY(role), on ? "on" : "off");
  } catch {
    // ignore
  }
}

function soundSettingsOf(settings: unknown): SoundSettings {
  const parsed = quizSettingsSchema.safeParse(settings ?? {});
  return parsed.success
    ? parsed.data.sound
    : quizSettingsSchema.parse({}).sound;
}

/** Whether a sound with this placement plays on this device by default / at all. */
function placement(
  playOn: SoundSettings["playOn"],
  role: Role,
  playerOptIn: boolean,
): { allowed: boolean; defaultOn: boolean } {
  const here =
    playOn === "both" || playOn === (role === "host" ? "host" : "players");
  if (here) return { allowed: true, defaultOn: true };
  if (role === "player" && playOn === "host" && playerOptIn) {
    return { allowed: true, defaultOn: false };
  }
  return { allowed: false, defaultOn: false };
}

interface SoundState {
  /** Sounds audible on this device right now. */
  on: boolean;
  /** The device's switch (muted or not), if it may play sound at all. */
  allowed: boolean;
  setOn: (on: boolean) => void;
  /** Whether a question's own sound plays on this device. */
  questionAudioHere: (audio: QuestionAudio | null | undefined) => boolean;
}

const SoundCtx = createContext<SoundState | null>(null);
export const useGameSound = () => useContext(SoundCtx);

/**
 * Events that count as a user gesture for autoplay. On touch screens
 * `pointerdown` does not (only `pointerup` / `touchend` / `click` do), so a
 * host who never touched the sound switch stayed silent on a tablet.
 */
const GESTURES = ["pointerup", "touchend", "click", "keydown"] as const;

/** Resume the AudioContext on every gesture (autoplay policies, iOS interruptions). */
function useUnlockAudio() {
  useEffect(() => {
    const unlock = () => {
      const ctx = audioContext();
      if (ctx && ctx.state !== "running") void ctx.resume();
    };
    for (const g of GESTURES) window.addEventListener(g, unlock);
    return () => {
      for (const g of GESTURES) window.removeEventListener(g, unlock);
    };
  }, []);
}

/**
 * Provides the sound state and preloads the question sounds that play here.
 * Render once per game screen (host or player) with the quiz's settings.
 */
export function GameSounds({
  role,
  quizSettings,
  children,
}: {
  role: Role;
  quizSettings: unknown;
  children?: ReactNode;
}) {
  useUnlockAudio();
  const settings = soundSettingsOf(quizSettings);
  const { allowed, defaultOn } = placement(
    settings.playOn,
    role,
    settings.playerOptIn,
  );
  const [pref, setPref] = useState<boolean | null>(null);
  useEffect(() => setPref(readPref(role)), [role]);
  const on = allowed && (pref ?? defaultOn);
  const setOn = (v: boolean) => {
    setPref(v);
    writePref(role, v);
    if (v) void audioContext()?.resume();
  };
  const preload = useAppSelector((s) => s.game.preload);

  const questionAudioHere = (audio: QuestionAudio | null | undefined) => {
    if (!audio) return false;
    const playOn = audio.playOn === "quiz" ? settings.playOn : audio.playOn;
    const p = placement(playOn, role, settings.playerOptIn);
    return p.allowed && (pref ?? p.defaultOn);
  };

  // Fetch the next question's (encrypted) clips early — on devices that will
  // play them. They stay unplayable until the question hands out the key.
  const wouldPlayHere = (playOn: QuestionAudio["playOn"]) =>
    questionAudioHere({ url: "", startMs: 0, revealMs: null, playOn });
  // The lobby: everything ahead — every question's sound where it plays
  // here. Cached; the per-question hints then find it.
  const lobbyAssets = useAppSelector((s) => s.game.lobbyAssets);
  useEffect(() => {
    if (!lobbyAssets) return;
    const urls = lobbyAssets.questions.flatMap((q) =>
      wouldPlayHere(q.playOn) ? q.urls : [],
    );
    void preloadAll(urls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyAssets]);

  useEffect(() => {
    if (preload && wouldPlayHere(preload.playOn)) {
      preloadClips(preload.urls, preload.qIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preload]);

  return (
    <SoundCtx.Provider value={{ on, allowed, setOn, questionAudioHere }}>
      {children}
    </SoundCtx.Provider>
  );
}

/** Speaker switch for this device (hidden when sound can't play here). */
export function SoundToggle({
  className,
  pill = false,
}: {
  className?: string;
  /** Header pill with a label, styled like the "Live" status. */
  pill?: boolean;
}) {
  const s = useGameSound();
  if (!s?.allowed) return null;
  if (pill) {
    return (
      <button
        type="button"
        aria-label={s.on ? "Mute sounds" : "Turn sounds on"}
        title={s.on ? "Mute sounds" : "Turn sounds on"}
        onClick={() => s.setOn(!s.on)}
        className="inline-flex items-center justify-center rounded-full border border-lprimary/15 dark:border-white/10 bg-white dark:bg-white/5 h-[34px] w-[38px] text-dark dark:text-white cursor-pointer hover:border-dprimary"
      >
        {s.on ? <LuVolume2 size={17} /> : <LuVolumeX size={17} />}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label={s.on ? "Mute sounds" : "Turn sounds on"}
      title={s.on ? "Mute sounds" : "Turn sounds on"}
      onClick={() => s.setOn(!s.on)}
      className={
        className ??
        "fixed top-3 right-3 z-50 size-10 rounded-full flex items-center justify-center bg-white/85 dark:bg-dark/85 border border-lprimary/15 dark:border-white/10 shadow cursor-pointer text-dark dark:text-white"
      }
    >
      {s.on ? <LuVolume2 size={18} /> : <LuVolumeX size={18} />}
    </button>
  );
}
