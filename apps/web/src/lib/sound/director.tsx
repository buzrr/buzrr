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
  isCueSlot,
  isQuestionSlot,
  isUnlimitedTime,
  quizSettingsSchema,
  soundSlotSchema,
  type BuiltinSoundOptions,
  type CueSlot,
  type CueSource,
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
  preloadAll,
  preloadClips,
} from "./preload";
import { DEFAULT_SONG_VOLUME, fadeInOf, playSong, type Timeline } from "./song";
import { useT } from "@/lib/i18n/context";
import {
  audioContext,
  builtinTuschZeroMs,
  playBuiltin,
  playCue,
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
  /** Where a lobby cue comes from for this skin. */
  cueSource: (cue: CueSlot) => CueSource;
  /** Play a lobby cue now (the caller rate-limits). */
  playCueSound: (cue: CueSlot) => void;
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
/** Closed this long before its deadline: an early close (music fades at once). */
const EARLY_CLOSE_MS = 500;
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

/** What `play` takes besides the slot. */
interface PlayExtra {
  progress?: () => number;
  /** Countdown / question: time until it ends. */
  remainingMs?: number;
  /** …and the wall clock when it ends (exact; preferred where known). */
  endsAt?: number;
  /** Told where in the file it plays. */
  onTimeline?: (tl: Timeline) => void;
  /** Start the file here instead of its own start point. */
  startMs?: number;
}

/** Songs that fade out over FADE_OUT_SEC when the next one takes over. */
const FADING_BEDS: readonly SoundSlot[] = ["lobby", "reveal", "scores"];

/**
 * Every song and effect started on this page, across screens: a screen that
 * goes (the host's lobby on "Start") can't be relied on to stop its own.
 */
const playing = new Set<SoundHandle>();
/** After `fadeOutAllSounds`, the next song waits until this wall clock. */
let fadeHoldUntil = 0;

/**
 * Fade out everything that plays (the host pressed "Start"); the next
 * song — the "Be prepared!" reveal music, the countdown — starts after it.
 */
export function fadeOutAllSounds(fadeSec: number) {
  for (const h of playing) h.stop(fadeSec, true);
  playing.clear();
  fadeHoldUntil = Date.now() + fadeSec * 1000;
}

/** Which bed (loop) a phase plays; null = none. */
function bedFor(phase: string): SoundSlot | null {
  switch (phase) {
    // "idle" is a page that hasn't heard from the server yet (e.g. the host's
    // game screen right after "Start"): no song until the real phase comes.
    case "lobby":
      return "lobby";
    // "Be prepared!" before a moderated question.
    case "ready":
      return "reveal";
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
  const builtinSkin = (BUILTIN_SOUND_SKINS as readonly string[]).includes(
    settings.skin,
  );
  // The skin's recordings and their options: a user skin's, or a built-in
  // skin's (the superadmin's; its slots without a file are synthesized).
  const builtinData = builtinSkin ? builtinOptions[settings.skin] : undefined;
  const files: Partial<Record<SoundSlot, string>> = builtinSkin
    ? (builtinData?.slots ?? {})
    : (skin?.slots ?? {});
  const slotOpts = (slot: SoundSlot) =>
    builtinSkin ? builtinData?.options[slot] : skin?.options?.[slot];
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

  // Lobby cues: a built-in skin plays its own; a user skin picks per cue
  // (default: its uploaded file, else Show's).
  const cueSource = (cue: CueSlot): CueSource => {
    if (builtinSkin) {
      return files[cue] ? "custom" : (settings.skin as CueSource);
    }
    return (
      skin?.options?.[cue]?.source ??
      (skin?.slots[cue] ? "custom" : "builtin:show")
    );
  };
  const playCueSound = (cue: CueSlot) => {
    const source = cueSource(cue);
    if (source === "off") return;
    const o = slotOpts(cue);
    if (source === "custom") {
      const url = files[cue];
      if (!url) return;
      playSong(
        async () => {
          await fetchSkinFiles([url]);
          return fetchClip(url);
        },
        cue,
        o,
      );
      return;
    }
    playCue(
      source,
      cue,
      (o?.volume ?? DEFAULT_SONG_VOLUME) / DEFAULT_SONG_VOLUME,
    );
  };

  // While the lobby / reveal / scores song fades out, the next one waits.
  const holdUntil = useRef(0);
  const play = (slot: SoundSlot, extra?: PlayExtra): SoundHandle | null => {
    // The scoreboard and the final standings start at once (on the host's
    // click), over the reveal's fade-out.
    const wait =
      slot === "scores" || slot === "final"
        ? 0
        : Math.max(holdUntil.current, fadeHoldUntil) - clockMs();
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
      stop: (fadeSec?: number, now?: boolean) => {
        cancelled = true;
        clearTimeout(timer);
        inner?.stop(fadeSec, now);
      },
    };
  };
  const playNow = (slot: SoundSlot, extra?: PlayExtra): SoundHandle | null => {
    const handle = startSound(slot, extra);
    if (!handle) return null;
    playing.add(handle);
    return {
      stop: (fadeSec?: number, now?: boolean) => {
        playing.delete(handle);
        handle.stop(fadeSec, now);
      },
    };
  };
  const startSound = (
    slot: SoundSlot,
    extra?: PlayExtra,
  ): SoundHandle | null => {
    const ctx = audioContext();
    if (ctx && ctx.state !== "running") void ctx.resume();
    // End-aligned songs need the time left in the countdown / question.
    const timing = {
      untilEndMs: extra?.remainingMs ?? null,
      endsAt: extra?.endsAt ?? null,
    };
    if (slot === "final" && !builtinSkin && skin?.finalClipUrl) {
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
    if (builtinSkin && !files[slot]) {
      const synthSlot = slot;
      const o = builtinData?.options[synthSlot];
      return playBuiltin(settings.skin as BuiltinSkinId, synthSlot, {
        // 80 (the default) = the usual synth level.
        volume:
          0.45 * ((o?.volume ?? DEFAULT_SONG_VOLUME) / DEFAULT_SONG_VOLUME),
        fadeInSec: fadeInOf(synthSlot, o),
        // Synth loops run until the phase ends unless repeat is set off.
        repeat: o?.repeat === false ? false : undefined,
        ...extra,
      });
    }
    const url = files[slot];
    // Fetched through the room's skin download slot (normally done already
    // in the lobby, see below).
    const load = async () => {
      await fetchSkinFiles([url!]);
      return fetchClip(url!);
    };
    return url
      ? playSong(
          load,
          slot,
          extra?.startMs !== undefined
            ? { ...slotOpts(slot), startMs: extra.startMs }
            : slotOpts(slot),
          timing,
          url,
          extra?.onTimeline,
        )
      : null;
  };

  // "Show answer" (closed → reveal) starts the scoreboard song, and "show
  // scores" lets it play on. After a question with its own sound it waits
  // for the scores.
  const [seenPhase, setSeenPhase] = useState(phase);
  const [scoresEarly, setScoresEarly] = useState(false);
  if (seenPhase !== phase) {
    setSeenPhase(phase);
    setScoresEarly(
      seenPhase === "closed" && phase === "reveal" && !question?.audio,
    );
  }

  // Bed for the phase. A question with its own sound here plays no bed.
  const bed = useRef<{
    key: string;
    slot: SoundSlot;
    handle: SoundHandle | null;
  } | null>(null);
  const deadlineRef = useRef(deadline);
  useEffect(() => {
    deadlineRef.current = deadline;
  });
  const ownAudio = phase === "question" && questionAudioHere(question?.audio);
  // The open question has its own sound with a reveal part, on this device.
  const ownRevealHere = useRef(false);
  useEffect(() => {
    if (phase === "question") {
      ownRevealHere.current =
        questionAudioHere(question?.audio) &&
        question?.audio?.revealMs !== null &&
        question?.audio?.revealMs !== undefined;
    }
  });
  // "No music": effects (countdown, tusch, reveal, pings) only.
  const phaseBed =
    on && !ownAudio && settings.music
      ? scoresEarly && phase === "reveal"
        ? "scores"
        : bedFor(phase)
      : null;
  // The last question has its own song when the skin has one — not the
  // only question of a one-question quiz (no finale to build up to).
  const lastQuestion =
    phaseBed === "question" &&
    qCount > 1 &&
    qIndex === qCount - 1 &&
    (builtinSkin || Boolean(files.lastQuestion));
  const bedSlot: SoundSlot | null = lastQuestion ? "lastQuestion" : phaseBed;
  const bedKey = bedSlot
    ? `${bedSlot}:${settings.skin}:${skin?.id ?? ""}:${files[bedSlot] ?? ""}:${bedSlot && isQuestionSlot(bedSlot) ? qIndex : ""}:${bedSlot === "final" ? (finalSoundKey ?? "") : ""}`
    : "";

  // Leaving the lobby, the reveal or the scoreboard: their song fades out
  // over FADE_OUT_SEC, and the next song starts once it is gone. Runs before
  // the bed and one-shot effects below (effects run in order).
  const reveal = useRef<SoundHandle | null>(null);
  const questionDeadline = useRef(0);
  const countdown = useRef<SoundHandle | null>(null);
  const tusch = useRef<{
    played: boolean;
    timer?: ReturnType<typeof setTimeout>;
  }>({ played: true });
  useEffect(() => () => clearTimeout(tusch.current.timer), []);
  /** Where the tusch's hit is: the skin's zero point, or the synth's roll. */
  const tuschZeroMs = () =>
    files.end
      ? (slotOpts("end")?.endMs ?? 0)
      : builtinSkin
        ? builtinTuschZeroMs(settings.skin as BuiltinSkinId)
        : 0;
  const countdownSlot = useRef<"countdown" | "lastCountdown">("countdown");
  const countdownTl = useRef<Timeline | null>(null);
  const left = useRef(phase);
  useEffect(() => {
    const from = left.current;
    left.current = phase;
    if (from === phase) return;
    let faded = false;
    if (
      bed.current &&
      FADING_BEDS.includes(bed.current.slot) &&
      bed.current.key !== bedKey
    ) {
      bed.current.handle?.stop(FADE_OUT_SEC);
      bed.current = null;
      faded = true;
    }
    // The question closed early (everyone answered, the host moved on): its
    // music fades out over a second at once, no extend.
    if (from === "question" && bed.current) {
      if (questionDeadline.current - clockMs() > EARLY_CLOSE_MS) {
        bed.current.handle?.stop(FADE_OUT_SEC, true);
        bed.current = null;
      }
    }
    if (phase === "question") questionDeadline.current = deadline;
    // Leaving the reveal; or on "Show answer" the scoreboard song, or the
    // question's own reveal part, taking over.
    if (
      (from === "reveal" ||
        // Straight on from "time's up" (nothing to reveal).
        (from === "closed" && phase !== "reveal") ||
        (phase === "reveal" &&
          (bedSlot === "scores" ||
            (from === "closed" && ownRevealHere.current)))) &&
      reveal.current
    ) {
      reveal.current.stop(FADE_OUT_SEC);
      reveal.current = null;
      faded = true;
    }
    if (faded) holdUntil.current = clockMs() + FADE_OUT_SEC * 1000;
    // The countdown is over: its song stops (an end-aligned one plays its
    // "after 0" seconds first) and the question music waits for that.
    if (from === "starting" && countdown.current) {
      countdown.current.stop();
      countdown.current = null;
      // When the question music may start: the countdown song's "question
      // music starts" point, else when that song is over (file end, or the
      // end of its extend).
      const o = slotOpts(countdownSlot.current);
      const tl = countdownTl.current;
      let startAt = 0;
      if (files[countdownSlot.current] && tl) {
        const wallOf = (fileMs: number) =>
          tl.startWall + (fileMs - tl.fileStartMs);
        if (o?.nextAtMs !== undefined) {
          startAt = wallOf(o.nextAtMs);
        } else if (o?.align === "end") {
          const zero = wallOf(o.endMs ?? tl.durationMs ?? 0);
          const stops = zero + (o.extendSec ?? 0) * 1000;
          startAt =
            tl.durationMs !== undefined
              ? Math.min(stops, wallOf(tl.durationMs))
              : stops;
        }
      }
      if (startAt > clockMs()) {
        holdUntil.current = Math.max(holdUntil.current, startAt);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on phase changes only
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
      slot: bedSlot,
      handle: play(bedSlot, {
        progress: () =>
          1 - Math.max(0, deadlineRef.current - Date.now()) / total,
        ...(timed
          ? {
              remainingMs: Math.max(0, deadlineRef.current - clockMs()),
              endsAt: deadlineRef.current,
            }
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
  const skinFiles = !on
    ? []
    : SKIN_SLOTS.filter(
        (s) =>
          (settings.music || !MUSIC_SLOTS.includes(s)) &&
          !(s === "final" && !builtinSkin && skin?.finalClipUrl) &&
          // Lobby cues play on the host only, and only its own files.
          (!isCueSlot(s) || (role === "host" && cueSource(s) === "custom")),
      )
        .map((s) => files[s])
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
  // The lobby: everything ahead — every question's picture, and its sound
  // where it plays here. Cached; the per-question hints then find it.
  const lobbyAssets = useAppSelector((s) => s.game.lobbyAssets);
  useEffect(() => {
    if (!lobbyAssets) return;
    const urls = lobbyAssets.questions.flatMap((q) => [
      ...(q.images ?? []),
      ...(wouldPlayHere(q.playOn) ? q.urls : []),
    ]);
    void preloadAll(urls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyAssets]);

  useEffect(() => {
    // The picture shows on every device; the sound only where it plays.
    const urls = preload
      ? [
          ...(preload.images ?? []),
          ...(wouldPlayHere(preload.playOn) ? preload.urls : []),
        ]
      : [];
    if (preload && urls.length > 0) preloadClips(urls, preload.qIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preload]);

  // The skin's final song: fetched encrypted while the game runs — each
  // player at a random moment within a minute of the start, so they don't
  // all download at once; the host at once, already in the lobby — and
  // playable once the final leaderboard brings the key.
  const finalUrl = builtinSkin ? null : (skin?.finalClipUrl ?? null);
  const gameRunning = phase !== "idle" && phase !== "lobby";
  const fetchFinal = role === "host" ? phase !== "idle" : gameRunning;
  useEffect(() => {
    if (!on || !settings.music || !fetchFinal || !finalUrl) return;
    const t = setTimeout(
      () => void fetchSkinFiles([finalUrl]),
      role === "host" ? 0 : Math.random() * 60_000,
    );
    return () => clearTimeout(t);
  }, [on, fetchFinal, finalUrl, role]);

  // One-shots on transitions.
  const prev = useRef(phase);
  useEffect(() => {
    const from = prev.current;
    prev.current = phase;
    if (!on || from === phase) return;
    if (phase === "starting") {
      countdown.current?.stop();
      // The last question's countdown has its own song when the skin has one
      // (not in a one-question quiz).
      const lastCd =
        qCount > 1 &&
        qIndex === qCount - 1 &&
        (builtinSkin || Boolean(files.lastCountdown));
      countdownSlot.current = lastCd ? "lastCountdown" : "countdown";
      // 0 is the deadline itself: beeps and the song's zero point land on it.
      countdownTl.current = null;
      countdown.current = play(countdownSlot.current, {
        remainingMs: countdownMs,
        ...(deadline > 0 ? { endsAt: deadline } : {}),
        onTimeline: (tl) => {
          countdownTl.current = tl;
        },
      });
    }
    // The tusch: planned so its zero point lands on the question's end (a
    // drum roll runs in during the last seconds), on top of the music —
    // nothing stops it. If the question closes early, it comes in right at
    // its zero point.
    if (phase === "question") {
      clearTimeout(tusch.current.timer);
      tusch.current = { played: false };
      const zero = tuschZeroMs();
      const left = deadline - clockMs();
      if (zero > 0 && !isUnlimitedTime(question?.timeOut) && left > 0) {
        const fire = (startMs?: number) => {
          tusch.current.played = true;
          play("end", startMs !== undefined ? { startMs } : undefined);
        };
        if (left > zero) {
          tusch.current.timer = setTimeout(() => fire(), left - zero);
        } else if (files.end) {
          fire(zero - left); // less time than lead-in: join it midway
        }
      }
    }
    if (
      from === "question" &&
      (phase === "closed" || phase === "reveal" || phase === "scores")
    ) {
      clearTimeout(tusch.current.timer);
      if (!tusch.current.played) {
        const zero = tuschZeroMs();
        play("end", zero > 0 && files.end ? { startMs: zero } : undefined);
      }
      tusch.current = { played: true };
    }
    // The reveal sound: right as the question ends (with the tusch on top),
    // and it plays on when the answer is shown. A question with its own
    // sound here gets it only while "time's up" waits for the host: its
    // reveal part plays at the answer instead, with nothing under it.
    if (
      from === "question" &&
      (phase === "closed" || (phase === "reveal" && !ownRevealHere.current))
    ) {
      reveal.current = play("reveal");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <SoundCtx.Provider
      value={{
        role,
        settings,
        on,
        allowed,
        setOn,
        questionAudioHere,
        cueSource,
        playCueSound,
      }}
    >
      {children}
    </SoundCtx.Provider>
  );
}

/** The host's lobby blopps for this many pops, then stays quiet. */
const LOBBY_BLOPPS = 20;

/**
 * The host's live cues: a ping when a player joins, a soft "blopp" for each
 * bubble a player pops (lobby, the first LOBBY_BLOPPS only) and a "pling"
 * for each reaction. Rate-limited so a full room doesn't turn into noise.
 */
export function LiveSounds({ socket }: { socket: GameSocket | null }) {
  const s = useGameSound();
  const on = Boolean(s?.on);
  // The latest sound state for the handlers (the skin may load later).
  const sound = useRef(s);
  useEffect(() => {
    sound.current = s;
  });
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
    const cue = (c: CueSlot) => sound.current?.playCueSound(c);
    const hits: Record<string, number> = {};
    // Only the lobby's first pops blopp — then it goes quiet.
    let blopps = 0;
    const blopp = () => {
      if (blopps >= LOBBY_BLOPPS) return;
      blopps += 1;
      cue("bubble");
    };
    // A crowd joining at once: one ping per 150 ms is plenty.
    const ping = () => limited("join", 150, () => cue("join"));
    // Arcade's chip pling cuts through: at most one every 5 s.
    const onReaction = () =>
      limited(
        "pling",
        sound.current?.cueSource("reaction") === "builtin:arcade" ? 5000 : 90,
        () => cue("reaction"),
      );
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
        setTimeout(() => limited("blopp", 70, blopp), (i * 900) / fresh);
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
