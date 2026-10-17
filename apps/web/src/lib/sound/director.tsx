"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LuVolume2, LuVolumeX } from "react-icons/lu";
import {
  BUILTIN_SOUND_SKINS,
  quizSettingsSchema,
  type QuestionAudio,
  type SoundSettings,
  type SoundSkin,
  type SoundSlot,
} from "@buzrr/contract";
import { useAppSelector } from "@/state/hooks";
import type { GameSocket } from "@/types/socket";
import { soundSkinsApi } from "@/lib/modules/sound-skins/api";
import { decryptClip, preloadClips } from "./preload";
import { fadeOutAndPause } from "./fade";
import {
  audioContext,
  isLoopSlot,
  playBuiltin,
  playBlopp,
  playPing,
  playPling,
  type BuiltinSkinId,
  type SoundHandle,
} from "./synth";

/**
 * Game sounds for the host's screen and the players' devices: a skin plays a
 * bed for the current phase (lobby, question, scores, final) and one-shots on
 * the way (countdown, the "tusch" when a question ends, the reveal). The
 * quiz's sound settings decide where (host / players / both / off) and
 * whether players may switch sound on themselves.
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

export function soundSettingsOf(settings: unknown): SoundSettings {
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
  role: Role;
  settings: SoundSettings;
  /** Game sounds audible on this device right now. */
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

/** Loads a user skin (null for built-in ones). */
function useSkin(id: string, role: Role): SoundSkin | null {
  const [skin, setSkin] = useState<SoundSkin | null>(null);
  useEffect(() => {
    if ((BUILTIN_SOUND_SKINS as readonly string[]).includes(id)) {
      setSkin(null);
      return;
    }
    let alive = true;
    soundSkinsApi
      .get(id, role === "player" ? "player" : "account")
      .then((s) => alive && setSkin(s))
      .catch(() => alive && setSkin(null));
    return () => {
      alive = false;
    };
  }, [id, role]);
  return skin;
}

function playFile(url: string, loop: boolean, volume: number): SoundHandle {
  const a = new Audio(url);
  a.loop = loop;
  a.volume = volume;
  let stopped = false;
  const retry = () => {
    if (!stopped && a.paused) start();
  };
  const unhook = () => {
    for (const g of GESTURES) window.removeEventListener(g, retry);
  };
  const start = () =>
    void a
      .play()
      .then(unhook)
      .catch(() => undefined);
  start();
  // Autoplay may refuse until the first gesture; retry then.
  for (const g of GESTURES) window.addEventListener(g, retry);
  return {
    stop: () => {
      stopped = true;
      unhook();
      fadeOutAndPause(a);
    },
  };
}

/** Decrypts a preloaded clip, then loops it like a file bed. */
function playEncrypted(url: string, key: string, volume: number): SoundHandle {
  let handle: SoundHandle | null = null;
  let stopped = false;
  let objectUrl: string | null = null;
  decryptClip(url, key)
    .then((u) => {
      objectUrl = u;
      if (!stopped) handle = playFile(u, true, volume);
    })
    .catch(() => undefined);
  return {
    stop: () => {
      stopped = true;
      handle?.stop();
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl!), 1500);
    },
  };
}

/** Which bed (loop) a phase plays; null = none. */
function bedFor(phase: string): SoundSlot | null {
  switch (phase) {
    case "idle":
    case "lobby":
    case "ready":
      return "lobby";
    case "question":
      return "question";
    case "scores":
      return "scores";
    case "final":
    case "ended":
      return "final";
    default:
      return null;
  }
}

/**
 * Provides the sound state and plays the skin for the current phase. Render
 * once per game screen (host or player) with the quiz's settings.
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

  const skin = useSkin(settings.skin, role);
  const phase = useAppSelector((s) => s.game.phase);
  const qIndex = useAppSelector((s) => s.game.qIndex);
  const deadline = useAppSelector((s) => s.game.deadline);
  const countdownMs = useAppSelector((s) => s.game.countdownMs);
  const question = useAppSelector((s) => s.game.question);
  const preload = useAppSelector((s) => s.game.preload);
  const finalSoundKey = useAppSelector((s) => s.game.finalSoundKey);

  const questionAudioHere = (audio: QuestionAudio | null | undefined) => {
    if (!audio) return false;
    const playOn = audio.playOn === "quiz" ? settings.playOn : audio.playOn;
    const p = placement(playOn, role, settings.playerOptIn);
    return p.allowed && (pref ?? p.defaultOn);
  };

  const play = (
    slot: SoundSlot,
    extra?: { progress?: () => number; remainingMs?: number },
  ) => {
    const ctx = audioContext();
    if (ctx && ctx.state !== "running") void ctx.resume();
    if (slot === "final" && skin?.finalClipUrl) {
      return finalSoundKey
        ? playEncrypted(skin.finalClipUrl, finalSoundKey, 0.8)
        : null;
    }
    const builtin = (BUILTIN_SOUND_SKINS as readonly string[]).includes(
      settings.skin,
    );
    if (builtin) {
      return playBuiltin(settings.skin as BuiltinSkinId, slot, {
        volume: 0.45,
        ...extra,
      });
    }
    const url = skin?.slots[slot];
    return url ? playFile(url, isLoopSlot(slot), 0.8) : null;
  };

  // Bed for the phase. A question with its own sound here plays no bed.
  const bed = useRef<{ key: string; handle: SoundHandle | null } | null>(null);
  const deadlineRef = useRef(deadline);
  useEffect(() => {
    deadlineRef.current = deadline;
  });
  const ownAudio = phase === "question" && questionAudioHere(question?.audio);
  const bedSlot = on && !ownAudio ? bedFor(phase) : null;
  const bedKey = bedSlot
    ? `${bedSlot}:${settings.skin}:${skin?.id ?? ""}:${bedSlot === "question" ? qIndex : ""}:${bedSlot === "final" ? (finalSoundKey ?? "") : ""}`
    : "";
  useEffect(() => {
    if (bed.current?.key === bedKey) return;
    bed.current?.handle?.stop();
    bed.current = null;
    if (!bedSlot) return;
    const total = (question?.timeOut ?? 20) * 1000;
    bed.current = {
      key: bedKey,
      handle: play(bedSlot, {
        progress: () =>
          1 - Math.max(0, deadlineRef.current - Date.now()) / total,
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedKey]);
  useEffect(() => () => bed.current?.handle?.stop(), []);

  // Fetch the next question's (encrypted) clips early — on devices that will
  // play them. They stay unplayable until the question hands out the key.
  const wouldPlayHere = (playOn: QuestionAudio["playOn"]) =>
    questionAudioHere({ url: "", startMs: 0, revealMs: null, playOn });
  useEffect(() => {
    if (preload && wouldPlayHere(preload.playOn)) {
      preloadClips(preload.urls, preload.qIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preload]);

  // The skin's final song: fetched encrypted while the game runs — each
  // device at a random moment within a minute of the start, so they don't
  // all download at once — and playable once the final leaderboard brings
  // the key.
  const finalUrl = skin?.finalClipUrl ?? null;
  const gameRunning = phase !== "idle" && phase !== "lobby";
  useEffect(() => {
    if (!on || !gameRunning || !finalUrl) return;
    const t = setTimeout(
      () => preloadClips([finalUrl]),
      Math.random() * 60_000,
    );
    return () => clearTimeout(t);
  }, [on, gameRunning, finalUrl]);

  // One-shots on transitions.
  const prev = useRef(phase);
  useEffect(() => {
    const from = prev.current;
    prev.current = phase;
    if (!on || from === phase) return;
    if (phase === "starting") play("countdown", { remainingMs: countdownMs });
    if (
      from === "question" &&
      (phase === "closed" || phase === "reveal" || phase === "scores")
    ) {
      play("end");
    }
    if (phase === "reveal") {
      // After the tusch if the question just closed.
      setTimeout(() => play("reveal"), from === "question" ? 900 : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <SoundCtx.Provider
      value={{ role, settings, on, allowed, setOn, questionAudioHere }}
    >
      {children}
    </SoundCtx.Provider>
  );
}

/** Host waiting room: a ping for every player who joins (if sound is on here). */
/**
 * The host's live cues: a ping when a player joins, a soft "blopp" for each
 * bubble a player pops (lobby) and a "pling" for each reaction. Rate-limited
 * so a full room doesn't turn into noise.
 */
export function LiveSounds({ socket }: { socket: GameSocket | null }) {
  const s = useGameSound();
  const on = Boolean(s?.on);
  useEffect(() => {
    if (!socket || !on) return;
    const last = { blopp: 0, pling: 0 };
    const limited = (
      kind: keyof typeof last,
      gapMs: number,
      play: () => void,
    ) => {
      const now = performance.now();
      if (now - last[kind] < gapMs) return;
      last[kind] = now;
      play();
    };
    const hits: Record<string, number> = {};
    const ping = () => playPing();
    const onReaction = () => limited("pling", 90, () => playPling());
    const onStats = (b: { playerId: string; hits: number }) => {
      const before = hits[b.playerId];
      hits[b.playerId] = b.hits;
      const fresh = before === undefined ? 0 : Math.min(5, b.hits - before);
      for (let i = 0; i < fresh; i++) {
        setTimeout(
          () => limited("blopp", 70, () => playBlopp()),
          (i * 900) / fresh,
        );
      }
    };
    socket.on("player-joined", ping);
    socket.on("reaction", onReaction);
    socket.on("bubble-stats", onStats);
    return () => {
      socket.off("player-joined", ping);
      socket.off("reaction", onReaction);
      socket.off("bubble-stats", onStats);
    };
  }, [socket, on]);
  return null;
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
        onClick={() => s.setOn(!s.on)}
        className="inline-flex items-center gap-2 rounded-full border border-lprimary/15 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-[13px] font-semibold text-dark dark:text-white cursor-pointer hover:border-dprimary"
      >
        {s.on ? <LuVolume2 size={15} /> : <LuVolumeX size={15} />}
        {s.on ? "Sound on" : "Sound off"}
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
