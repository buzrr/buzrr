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
  isQuestionSlot,
  isUnlimitedTime,
  quizSettingsSchema,
  soundSlotSchema,
  type BuiltinSoundOptions,
  type QuestionAudio,
  type SoundSettings,
  type SoundSkin,
  type SoundSlot,
} from "@buzrr/contract";
import { useAppSelector } from "@/state/hooks";
import type { GameSocket } from "@/types/socket";
import { soundSkinsApi } from "@/lib/modules/sound-skins/api";
import {
  decryptClipBuffer,
  fetchClip,
  fetchSkinFiles,
  preloadClips,
} from "./preload";
import { DEFAULT_SONG_VOLUME, playSong } from "./song";
import { useT } from "@/lib/i18n/context";
import {
  audioContext,
  playBuiltin,
  playArcadeBlopp,
  playArcadeJoin,
  playArcadePling,
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

/** The built-in skins' options (the superadmin's), loaded once per page. */
function useBuiltinOptions(skinId: string, role: Role): BuiltinSoundOptions {
  const [opts, setOpts] = useState<BuiltinSoundOptions>({});
  const builtin = (BUILTIN_SOUND_SKINS as readonly string[]).includes(skinId);
  useEffect(() => {
    if (!builtin) return;
    let alive = true;
    soundSkinsApi
      .builtinOptions(role === "player" ? "player" : "account")
      .then((o) => alive && setOpts(o))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [builtin, role]);
  return opts;
}

const SKIN_SLOTS = soundSlotSchema.options;
/** Lobby, reveal and scoreboard songs fade out this long before the next starts. */
const FADE_OUT_SEC = 1;
/** Wall clock for the fade hold (only read in effects and event callbacks). */
const clockMs = () => Date.now();
/** Background music (off with "no music"). */
const MUSIC_SLOTS: readonly SoundSlot[] = [
  "lobby",
  "question",
  "lastQuestion",
  "scores",
  "final",
];

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
  const raw = soundSettingsOf(quizSettings);
  // Normally resolved by the server; a stray "default" plays the first skin.
  const settings =
    raw.skin === "default" ? { ...raw, skin: "builtin:show" } : raw;
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
  const builtinOptions = useBuiltinOptions(settings.skin, role);
  const phase = useAppSelector((s) => s.game.phase);
  const qIndex = useAppSelector((s) => s.game.qIndex);
  const qCount = useAppSelector((s) => s.game.qCount);
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

  // While the lobby / reveal / scores song fades out, the next one waits.
  const holdUntil = useRef(0);
  const play = (
    slot: SoundSlot,
    extra?: { progress?: () => number; remainingMs?: number },
  ): SoundHandle | null => {
    const wait = holdUntil.current - clockMs();
    if (wait <= 0) return playNow(slot, extra);
    // Starts after the fade; a countdown keeps its end where it was.
    let inner: SoundHandle | null = null;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      inner = playNow(slot, {
        ...extra,
        ...(extra?.remainingMs !== undefined
          ? { remainingMs: Math.max(0, extra.remainingMs - wait) }
          : {}),
      });
    }, wait);
    return {
      stop: (fadeSec?: number) => {
        cancelled = true;
        clearTimeout(timer);
        inner?.stop(fadeSec);
      },
    };
  };
  const playNow = (
    slot: SoundSlot,
    extra?: { progress?: () => number; remainingMs?: number },
  ): SoundHandle | null => {
    const ctx = audioContext();
    if (ctx && ctx.state !== "running") void ctx.resume();
    // End-aligned songs need the time left in the countdown / question.
    const timing = { untilEndMs: extra?.remainingMs ?? null };
    if (slot === "final" && skin?.finalClipUrl) {
      const url = skin.finalClipUrl;
      return finalSoundKey
        ? playSong(
            () => decryptClipBuffer(url, finalSoundKey),
            slot,
            skin.options?.final,
            timing,
          )
        : null;
    }
    const builtin = (BUILTIN_SOUND_SKINS as readonly string[]).includes(
      settings.skin,
    );
    if (builtin) {
      // Synth skins have one question music.
      const synthSlot = slot === "lastQuestion" ? "question" : slot;
      const o = builtinOptions[settings.skin]?.[synthSlot];
      return playBuiltin(settings.skin as BuiltinSkinId, synthSlot, {
        // 80 (the default) = the usual synth level.
        volume:
          0.45 * ((o?.volume ?? DEFAULT_SONG_VOLUME) / DEFAULT_SONG_VOLUME),
        fadeInSec: o?.fadeIn ? (o.fadeInSec ?? 2) : 0,
        // Synth loops run until the phase ends unless repeat is set off.
        repeat: o?.repeat === false ? false : undefined,
        ...extra,
      });
    }
    const url = skin?.slots[slot];
    // Fetched through the room's skin download slot (normally done already
    // in the lobby, see below).
    const load = async () => {
      await fetchSkinFiles([url!]);
      return fetchClip(url!);
    };
    return url
      ? playSong(load, slot, skin?.options?.[slot], timing, url)
      : null;
  };

  // Bed for the phase. A question with its own sound here plays no bed.
  const bed = useRef<{ key: string; handle: SoundHandle | null } | null>(null);
  const deadlineRef = useRef(deadline);
  useEffect(() => {
    deadlineRef.current = deadline;
  });
  const ownAudio = phase === "question" && questionAudioHere(question?.audio);
  // "No music": effects (countdown, tusch, reveal, pings) only.
  const phaseBed = on && !ownAudio && settings.music ? bedFor(phase) : null;
  // The last question has its own song when the skin has one.
  const lastQuestion =
    phaseBed === "question" &&
    qCount > 0 &&
    qIndex === qCount - 1 &&
    Boolean(skin?.slots.lastQuestion);
  const bedSlot: SoundSlot | null = lastQuestion ? "lastQuestion" : phaseBed;
  const bedKey = bedSlot
    ? `${bedSlot}:${settings.skin}:${skin?.id ?? ""}:${bedSlot && isQuestionSlot(bedSlot) ? qIndex : ""}:${bedSlot === "final" ? (finalSoundKey ?? "") : ""}`
    : "";

  // Leaving the lobby, the reveal or the scoreboard: their song fades out
  // over FADE_OUT_SEC, and the next song starts once it is gone. Runs before
  // the bed and one-shot effects below (effects run in order).
  const reveal = useRef<SoundHandle | null>(null);
  const left = useRef(phase);
  useEffect(() => {
    const from = left.current;
    left.current = phase;
    if (from === phase) return;
    let faded = false;
    const fromBed = bedFor(from);
    if (
      bed.current &&
      (fromBed === "lobby" || fromBed === "scores") &&
      bedFor(phase) !== fromBed
    ) {
      bed.current.handle?.stop(FADE_OUT_SEC);
      bed.current = null;
      faded = true;
    }
    if (from === "reveal" && reveal.current) {
      reveal.current.stop(FADE_OUT_SEC);
      reveal.current = null;
      faded = true;
    }
    if (faded) holdUntil.current = clockMs() + FADE_OUT_SEC * 1000;
  }, [phase]);
  useEffect(() => {
    if (bed.current?.key === bedKey) return;
    bed.current?.handle?.stop();
    bed.current = null;
    if (!bedSlot) return;
    const total = (question?.timeOut ?? 20) * 1000;
    // A timed question: how long it still runs (end-aligned songs); "∞": none.
    const timed =
      isQuestionSlot(bedSlot) && !isUnlimitedTime(question?.timeOut);
    bed.current = {
      key: bedKey,
      handle: play(bedSlot, {
        progress: () =>
          1 - Math.max(0, deadlineRef.current - Date.now()) / total,
        ...(timed
          ? { remainingMs: Math.max(0, deadlineRef.current - clockMs()) }
          : {}),
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedKey]);
  useEffect(() => () => bed.current?.handle?.stop(), []);

  // The skin's files, once, while waiting in the lobby: through the room's
  // skin download slot, so a full room joining doesn't fetch them all at
  // once. Only what plays here (no music: effects only; the final song comes
  // encrypted, separately).
  const skinFiles =
    !on || !skin
      ? []
      : SKIN_SLOTS.filter(
          (s) =>
            (settings.music || !MUSIC_SLOTS.includes(s)) &&
            !(s === "final" && skin.finalClipUrl),
        )
          .map((s) => skin.slots[s])
          .filter((u): u is string => Boolean(u));
  const skinFilesKey = skinFiles.join("|");
  useEffect(() => {
    if (skinFiles.length > 0) void fetchSkinFiles(skinFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skinFilesKey]);

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
    if (!on || !settings.music || !gameRunning || !finalUrl) return;
    const t = setTimeout(
      () => void fetchSkinFiles([finalUrl]),
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
      setTimeout(
        () => {
          if (left.current === "reveal") reveal.current = play("reveal");
        },
        from === "question" ? 900 : 0,
      );
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
    const last = { blopp: 0, pling: 0, join: 0 };
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
    // The Arcade skin has its own 8-bit pickups.
    const arcade = s?.settings.skin === "builtin:arcade";
    // A crowd joining at once: one ping per 150 ms is plenty.
    const ping = () =>
      limited("join", 150, () => (arcade ? playArcadeJoin() : playPing()));
    // Arcade's chip pling cuts through: at most one every 5 s.
    const onReaction = () =>
      arcade
        ? limited("pling", 5000, () => playArcadePling())
        : limited("pling", 90, () => playPling());
    // One batch a second: the room's new pops spread over that second
    // (at most 12 blopps — a full room shouldn't drone).
    const onStats = ({
      players,
    }: {
      players: Record<string, { hits: number }>;
    }) => {
      let fresh = 0;
      for (const [id, b] of Object.entries(players)) {
        const before = hits[id];
        hits[id] = b.hits;
        if (before !== undefined) fresh += Math.max(0, b.hits - before);
      }
      fresh = Math.min(12, fresh);
      for (let i = 0; i < fresh; i++) {
        setTimeout(
          () =>
            limited("blopp", 70, () =>
              arcade ? playArcadeBlopp() : playBlopp(),
            ),
          (i * 900) / fresh,
        );
      }
    };
    socket.on("player-joined", ping);
    socket.on("reaction", onReaction);
    socket.on("bubble-stats-batch", onStats);
    return () => {
      socket.off("player-joined", ping);
      socket.off("reaction", onReaction);
      socket.off("bubble-stats-batch", onStats);
    };
  }, [socket, on, s?.settings.skin]);
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
  const t = useT();
  const s = useGameSound();
  if (!s?.allowed) return null;
  if (pill) {
    return (
      <button
        type="button"
        aria-label={s.on ? t("Mute sounds") : t("Turn sounds on")}
        title={s.on ? t("Mute sounds") : t("Turn sounds on")}
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
      aria-label={s.on ? t("Mute sounds") : t("Turn sounds on")}
      title={s.on ? t("Mute sounds") : t("Turn sounds on")}
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
