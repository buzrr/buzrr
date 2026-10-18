"use client";

import { isCueSlot, type CueSlot, type SoundSlot } from "@buzrr/contract";

/**
 * The built-in sound skins, synthesized with the Web Audio API — no audio
 * files, nothing to license. A skin is a tempo, a sound palette and a key;
 * every slot is either a loop (lobby, question, scores, final) or a one-shot
 * (countdown, end, reveal).
 */

export type BuiltinSkinId = "builtin:show" | "builtin:arcade" | "builtin:chill";

interface Palette {
  name: string;
  bpm: number;
  lead: OscillatorType;
  bass: OscillatorType;
  pad: OscillatorType;
  /** Semitones from A4 for the chord roots of the 4-bar progression. */
  roots: number[];
  /** Scale degrees (semitones) for melodies. */
  scale: number[];
  /** Brightness of the lead (lowpass cutoff, Hz). */
  cutoff: number;
  /** Overall level of drums (0..1). */
  drums: number;
  /** The scoreboard loop: its own progression, riff (semitones above the
   *  chord root per 8th, null = rest; 16 steps = 2 bars) and lead voice, so
   *  it doesn't sound like the question music. */
  scores: {
    roots: number[];
    riff: (number | null)[];
    lead: OscillatorType;
  };
  /** The final leaderboard: a 4-bar anthem. Melody notes are semitones from
   *  A4 with a length in 8ths (null = rest), 32 8ths in all; `halfTime`
   *  gives the drums a slow, stadium feel. */
  final: {
    roots: number[];
    melody: [number | null, number][];
    lead: OscillatorType;
    halfTime: boolean;
  };
}

export const BUILTIN_SKINS: Record<BuiltinSkinId, Palette> = {
  "builtin:show": {
    name: "TV Game Show",
    bpm: 118,
    lead: "sawtooth",
    bass: "square",
    pad: "sawtooth",
    roots: [-9, -4, -2, -7], // C – F – G – Am (relative to A4)
    scale: [0, 2, 4, 7, 9, 12],
    cutoff: 2600,
    drums: 0.9,
    scores: {
      roots: [-7, -2, -9, -4], // Am – G – C – F
      riff: [
        12,
        null,
        16,
        19,
        null,
        16,
        12,
        null,
        14,
        null,
        12,
        7,
        null,
        9,
        12,
        null,
      ],
      lead: "triangle",
    },
    final: {
      // Stadium anthem: C – G – Am – F, a melody that climbs and lands.
      roots: [-9, -2, -12, -4],
      melody: [
        [7, 2],
        [10, 2],
        [15, 4],
        [14, 3],
        [12, 1],
        [10, 4],
        [12, 2],
        [15, 2],
        [19, 3],
        [17, 1],
        [15, 4],
        [12, 2],
        [10, 2],
      ],
      lead: "sawtooth",
      halfTime: true,
    },
  },
  "builtin:arcade": {
    name: "Arcade",
    bpm: 138,
    lead: "square",
    bass: "triangle",
    pad: "square",
    roots: [-12, -8, -5, -10], // A – C# – E – B, bright 8-bit
    scale: [0, 3, 5, 7, 10, 12],
    cutoff: 5000,
    drums: 0.7,
    scores: {
      roots: [-5, -12, -10, -7], // E – A – B – D
      riff: [0, 7, 12, 7, 0, 7, 15, 12, 3, 10, 15, 10, 3, 12, 19, null],
      lead: "sawtooth",
    },
    final: {
      // Synth-brass fanfare: Am – F – G – E, staccato pick-ups into long hits.
      roots: [-12, -4, -2, -5],
      melody: [
        [12, 1],
        [null, 1],
        [12, 1],
        [15, 1],
        [19, 2],
        [17, 1],
        [15, 1],
        [15, 1],
        [null, 1],
        [15, 1],
        [12, 1],
        [17, 2],
        [15, 1],
        [12, 1],
        [14, 1],
        [null, 1],
        [14, 1],
        [17, 1],
        [22, 2],
        [19, 1],
        [17, 1],
        [19, 3],
        [23, 1],
        [19, 2],
        [null, 2],
      ],
      lead: "square",
      halfTime: false,
    },
  },
  "builtin:chill": {
    name: "Chill",
    bpm: 88,
    lead: "sine",
    bass: "sine",
    pad: "triangle",
    roots: [-12, -7, -9, -5], // Am – Dm – Cmaj – Em
    scale: [0, 3, 7, 10, 12, 15],
    cutoff: 1400,
    drums: 0.45,
    scores: {
      roots: [-9, -5, -12, -7], // C – E – Am – Dm, laid-back
      riff: [
        null,
        12,
        null,
        10,
        7,
        null,
        3,
        null,
        null,
        15,
        12,
        null,
        10,
        null,
        7,
        null,
      ],
      lead: "triangle",
    },
    final: {
      // Warm and glowing: Am – Dm – C – Em, long gentle notes.
      roots: [-12, -7, -9, -5],
      melody: [
        [12, 2],
        [15, 2],
        [19, 4],
        [17, 2],
        [15, 2],
        [12, 4],
        [15, 2],
        [19, 2],
        [22, 2],
        [19, 2],
        [17, 6],
        [null, 2],
      ],
      lead: "triangle",
      halfTime: true,
    },
  },
};

const LOOP_SLOTS: SoundSlot[] = [
  "lobby",
  "question",
  "lastQuestion",
  "scores",
  "final",
];
export const isLoopSlot = (slot: SoundSlot) => LOOP_SLOTS.includes(slot);

let sharedCtx: AudioContext | null = null;
/**
 * While `renderBuiltin` runs (synchronously): the offline context everything
 * is scheduled on, and how many seconds it holds. Loops are then planned in
 * full up front, and no cleanup timers run.
 */
let rendering: { ctx: OfflineAudioContext; seconds: number } | null = null;
/** Cleanup after a sound (disconnecting its bus): skipped while rendering. */
function later(fn: () => void, ms: number) {
  if (!rendering) setTimeout(fn, ms);
}

/** One AudioContext for the page; resumed on the first user gesture. */
export function audioContext(): AudioContext | null {
  if (rendering) return rendering.ctx as unknown as AudioContext;
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

const hz = (semisFromA4: number) => 440 * Math.pow(2, semisFromA4 / 12);

let noiseBuffer: AudioBuffer | null = null;
function noise(ctx: AudioContext) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** A voice: oscillator → lowpass → envelope → out. */
function tone(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  dur: number,
  type: OscillatorType,
  level: number,
  cutoff = 4000,
) {
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  f.type = "lowpass";
  f.frequency.setValueAtTime(cutoff, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function kick(ctx: AudioContext, out: AudioNode, t: number, level: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.35);
}

function hiss(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  dur: number,
  level: number,
  filter: BiquadFilterType,
  freq: number,
) {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t);
  s.stop(t + dur + 0.05);
}

const hat = (c: AudioContext, o: AudioNode, t: number, l: number) =>
  hiss(c, o, t, 0.05, l * 0.35, "highpass", 7000);
const snare = (c: AudioContext, o: AudioNode, t: number, l: number) => {
  hiss(c, o, t, 0.18, l * 0.5, "bandpass", 1800);
  tone(c, o, t, 190, 0.1, "triangle", l * 0.3);
};
const crash = (c: AudioContext, o: AudioNode, t: number, l: number) =>
  hiss(c, o, t, 1.6, l * 0.5, "highpass", 4500);

function chord(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  root: number,
  dur: number,
  type: OscillatorType,
  level: number,
  cutoff: number,
) {
  for (const i of [0, 4, 7, 12])
    tone(ctx, out, t, hz(root + i), dur, type, level, cutoff);
}

/** A running loop or one-shot; `stop` fades it out. */
export interface SoundHandle {
  /** Stop, fading out over `fadeSec` (default: a short fade). */
  stop: (fadeSec?: number) => void;
}

/**
 * Plays a built-in slot. `progress()` (0..1) lets the question loop build
 * up towards the end of the answer time; `remainingMs` times the countdown.
 */
export function playBuiltin(
  skinId: BuiltinSkinId,
  slot: SoundSlot,
  opts: {
    volume?: number;
    progress?: () => number;
    remainingMs?: number;
    /** Fade in over this many seconds (superadmin's skin options). */
    fadeInSec?: number;
    /** Loops: false = one pass of BUILTIN_PASS_BARS bars, then fade out. */
    repeat?: boolean;
  } = {},
): SoundHandle {
  const ctx = audioContext();
  if (!ctx) return { stop: () => undefined };
  const p = BUILTIN_SKINS[skinId] ?? BUILTIN_SKINS["builtin:show"];
  const bus = ctx.createGain();
  const level = opts.volume ?? 0.5;
  bus.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.05;
  if (opts.fadeInSec && opts.fadeInSec > 0) {
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(level, t0 + opts.fadeInSec);
  } else {
    bus.gain.value = level;
  }
  const beat = 60 / p.bpm;
  const d = p.drums;
  // Arcade: an 8-bit kick (a triangle sweep, like an old console's).
  const K = skinId === "builtin:arcade" ? chipKick : kick;

  const fadeOut = (fadeSec = 0.4) => {
    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
    later(() => bus.disconnect(), fadeSec * 1000 + 200);
  };

  // -- lobby cues (join / bubble / reaction): the skin's own variant ---------
  if (isCueSlot(slot)) {
    bus.disconnect();
    playCue(skinId, slot, (opts.volume ?? 0.45) / 0.45);
    return { stop: () => undefined };
  }

  // The last question's countdown and music: the same, stepped up (higher,
  // a bigger hit; faster and building from the start).
  const last = slot === "lastCountdown" || slot === "lastQuestion";
  const up = last ? 5 : 0; // semitones

  // -- Arcade one-shots: 8-bit, square waves only ---------------------------
  if (skinId === "builtin:arcade") {
    if (slot === "countdown" || slot === "lastCountdown") {
      // A race-start beep per second, the last one an octave up and long.
      const secs = Math.max(1, Math.round((opts.remainingMs ?? 5000) / 1000));
      for (let i = 0; i < secs; i++) {
        chip(ctx, bus, t0 + i, hz(12 + up), 0.12, 0.35);
        if (last) chip(ctx, bus, t0 + i + 0.5, hz(12 + up), 0.06, 0.2);
      }
      chip(ctx, bus, t0 + secs, hz(24 + up), last ? 0.9 : 0.5, 0.4);
      if (last) chip(ctx, bus, t0 + secs, hz(31 + up), 0.9, 0.25);
      return { stop: fadeOut };
    }
    if (slot === "end") {
      // Time's up: a quick fall, then a little two-chord sting.
      [24, 19, 15, 12].forEach((n, i) =>
        chip(ctx, bus, t0 + i * 0.06, hz(n), 0.06, 0.35),
      );
      const hit = t0 + 0.3;
      [12, 16, 19].forEach((n) => chip(ctx, bus, hit, hz(n), 0.14, 0.18));
      [17, 21, 24].forEach((n) =>
        chip(ctx, bus, hit + 0.18, hz(n), 0.45, 0.18),
      );
      return { stop: fadeOut };
    }
    if (slot === "reveal") {
      // The answer: a sparkling run up two octaves, ending on a held note.
      [12, 16, 19, 24, 28, 31, 36].forEach((n, i) =>
        chip(ctx, bus, t0 + i * 0.045, hz(n), 0.06, 0.28),
      );
      chip(ctx, bus, t0 + 7 * 0.045, hz(36), 0.35, 0.3);
      return { stop: fadeOut };
    }
  }

  // -- one-shots ------------------------------------------------------------
  if (slot === "countdown" || slot === "lastCountdown") {
    const secs = Math.max(1, Math.round((opts.remainingMs ?? 5000) / 1000));
    for (let i = 0; i < secs; i++) {
      tone(
        ctx,
        bus,
        t0 + i,
        hz(p.scale[i % p.scale.length]! + 3 + up),
        0.18,
        p.lead,
        0.3,
        p.cutoff,
      );
      K(ctx, bus, t0 + i, 0.5 * d);
      // The last one: a heartbeat — a second kick on every half second.
      if (last) K(ctx, bus, t0 + i + 0.5, 0.35 * d + 0.1);
    }
    chord(
      ctx,
      bus,
      t0 + secs,
      p.roots[0]! + 12 + up,
      last ? 1.4 : 0.7,
      p.pad,
      0.12,
      p.cutoff,
    );
    crash(ctx, bus, t0 + secs, d);
    if (last) crash(ctx, bus, t0 + secs + 0.02, 1);
    return { stop: fadeOut };
  }
  if (slot === "end") {
    // Tusch: drum roll, then two chord stabs and a crash.
    for (let i = 0; i < 10; i++) snare(ctx, bus, t0 + i * 0.045, 0.5 * d + 0.2);
    const hit = t0 + 0.5;
    chord(ctx, bus, hit, p.roots[0]!, 0.25, p.pad, 0.13, p.cutoff);
    chord(ctx, bus, hit + 0.3, p.roots[0]! + 12, 1.1, p.pad, 0.15, p.cutoff);
    K(ctx, bus, hit + 0.3, 0.8);
    crash(ctx, bus, hit + 0.3, 1);
    return { stop: fadeOut };
  }
  if (slot === "reveal") {
    p.scale.concat(p.scale.map((s) => s + 12)).forEach((s, i) => {
      tone(
        ctx,
        bus,
        t0 + i * 0.06,
        hz(p.roots[0]! + 12 + s),
        0.35,
        p.lead,
        0.16,
        p.cutoff + 1500,
      );
    });
    hiss(ctx, bus, t0, 0.8, 0.12, "bandpass", 6000);
    return { stop: fadeOut };
  }

  // -- loops (look-ahead scheduler) ------------------------------------------
  const party = slot === "scores" || slot === "final";
  const tempo =
    slot === "final" ? 1.12 : party ? 1.05 : slot === "lobby" ? 0.9 : 1;
  let step = 0; // 8th notes
  let next = t0;
  if (slot === "final") {
    chord(ctx, bus, t0, p.roots[0]! + 12, 1.2, p.pad, 0.14, p.cutoff);
    crash(ctx, bus, t0, d);
  }
  // Rendering offline: everything at once, the question building up over it.
  const offline = rendering ? { seconds: rendering.seconds } : null;
  const tick = () => {
    const ahead = offline ? t0 + offline.seconds : ctx.currentTime + 0.12;
    while (slot === "scores" && next < ahead) {
      // Scoreboard: four-on-the-floor, claps on 2 and 4, pumping offbeat
      // bass and its own riff — clearly not the question loop.
      const sc = p.scores;
      const eighth = beat / 2 / tempo;
      const bar = Math.floor(step / 8) % sc.roots.length;
      const root = sc.roots[bar]!;
      const inBar = step % 8;
      const onBeat = inBar % 2 === 0;
      if (onBeat) K(ctx, bus, next, 0.75 * d);
      else hiss(ctx, bus, next, 0.09, 0.07 * d + 0.02, "highpass", 7000);
      if (inBar === 2 || inBar === 6) snare(ctx, bus, next, 0.5 * d + 0.15);
      if (!onBeat) {
        tone(ctx, bus, next, hz(root - 24), eighth * 0.8, p.bass, 0.24, 800);
      }
      if (inBar === 0) {
        chord(ctx, bus, next, root, beat * 4, p.pad, 0.045, p.cutoff * 0.5);
      }
      const note = sc.riff[step % sc.riff.length];
      if (note !== null && note !== undefined) {
        tone(
          ctx,
          bus,
          next,
          hz(root + note),
          eighth * 0.9,
          sc.lead,
          0.11,
          p.cutoff,
        );
      }
      next += eighth;
      step++;
    }
    while (slot === "final" && next < ahead) {
      // Final leaderboard: the skin's anthem over big chords.
      const fin = p.final;
      const eighth = beat / 2 / tempo;
      const bar = Math.floor(step / 8) % fin.roots.length;
      const root = fin.roots[bar]!;
      const inBar = step % 8;
      if (fin.halfTime) {
        if (inBar === 0) K(ctx, bus, next, 0.8 * d + 0.1);
        if (inBar === 4) snare(ctx, bus, next, 0.6 * d + 0.2);
        if (inBar % 2 === 1) hat(ctx, bus, next, 0.5 * d);
      } else {
        if (inBar % 2 === 0) K(ctx, bus, next, 0.75 * d);
        else hat(ctx, bus, next, d);
        if (inBar === 2 || inBar === 6) snare(ctx, bus, next, 0.55 * d + 0.1);
      }
      if (inBar === 0) {
        chord(ctx, bus, next, root, beat * 4, p.pad, 0.07, p.cutoff * 0.7);
        tone(ctx, bus, next, hz(root - 24), beat * 3.5, p.bass, 0.25, 700);
        if (bar === 0) crash(ctx, bus, next, 0.6 * d + 0.2);
      }
      // The melody note that starts on this 8th, if any.
      let at = 0;
      const pos = step % 32;
      for (const [note, len] of fin.melody) {
        if (at === pos && note !== null) {
          const dur = eighth * len * 0.95;
          tone(ctx, bus, next, hz(note), dur, fin.lead, 0.13, p.cutoff + 800);
          // An octave below, softer: a fuller, singalong lead.
          tone(ctx, bus, next, hz(note - 12), dur, "triangle", 0.07, p.cutoff);
        }
        at += len;
        if (at > pos) break;
      }
      next += eighth;
      step++;
    }
    while (slot !== "scores" && slot !== "final" && next < ahead) {
      // The question loop gets faster and denser towards the end.
      const raw =
        slot === "question" || slot === "lastQuestion"
          ? Math.min(
              1,
              offline
                ? (next - t0) / offline.seconds
                : (opts.progress?.() ?? 0),
            )
          : 0;
      // The last question starts where a question ends up: driving.
      const prog = slot === "lastQuestion" ? 0.5 + raw * 0.5 : raw;
      const eighth = beat / 2 / (tempo * (1 + prog * 0.35));
      const bar = Math.floor(step / 8) % p.roots.length;
      const root = p.roots[bar]!;
      const inBar = step % 8;
      const onBeat = inBar % 2 === 0;

      if (party || slot === "question" || slot === "lastQuestion") {
        if (onBeat) K(ctx, bus, next, 0.7 * d);
        else hat(ctx, bus, next, d);
        if (inBar === 2 || inBar === 6) snare(ctx, bus, next, 0.6 * d);
      } else {
        if (inBar === 0) K(ctx, bus, next, 0.45 * d);
        if (!onBeat) hat(ctx, bus, next, 0.5 * d);
      }
      // bass
      if (onBeat || party) {
        tone(
          ctx,
          bus,
          next,
          hz(root - 24 + (party && !onBeat ? 12 : 0)),
          eighth * 0.9,
          p.bass,
          0.22,
          900,
        );
      }
      // chords on the bar
      if (inBar === 0) {
        chord(
          ctx,
          bus,
          next,
          root,
          beat * (party ? 1 : 3),
          p.pad,
          slot === "lobby" ? 0.05 : 0.06,
          p.cutoff * 0.6,
        );
      }
      // melody
      const melodic =
        slot === "lobby" ? inBar % 4 === 1 : party ? true : inBar % 2 === 1;
      if (melodic) {
        const deg = p.scale[(step * 3 + bar) % p.scale.length]!;
        tone(
          ctx,
          bus,
          next,
          hz(root + 12 + deg),
          eighth * 0.8,
          p.lead,
          party ? 0.1 : 0.07,
          p.cutoff,
        );
      }
      // last stretch of a question: a tick per beat, rising
      if (
        (slot === "question" || slot === "lastQuestion") &&
        prog > 0.75 &&
        onBeat
      ) {
        tone(
          ctx,
          bus,
          next,
          hz(24 + Math.round(prog * 12)),
          0.05,
          "square",
          0.12,
          8000,
        );
      }
      next += eighth;
      step++;
    }
  };
  if (offline) {
    tick();
    return { stop: () => undefined };
  }
  // Repeat off: one pass (a synth loop has no end of its own), then out.
  const passEnd = opts.repeat === false ? BUILTIN_PASS_BARS * 8 : Infinity;
  let ended = false;
  const run = () => {
    if (ended) return;
    if (step >= passEnd) {
      ended = true;
      clearInterval(timer);
      setTimeout(fadeOut, Math.max(0, (next - ctx.currentTime) * 1000));
      return;
    }
    tick();
  };
  const timer = setInterval(run, 40);
  run();
  return {
    stop: (fadeSec?: number) => {
      clearInterval(timer);
      if (!ended) fadeOut(fadeSec);
      ended = true;
    },
  };
}

/** How much of each built-in slot `renderBuiltin` draws (loops: a stretch). */
export function builtinRenderSec(slot: SoundSlot): number {
  if (isCueSlot(slot)) return 1.5;
  if (slot === "countdown" || slot === "lastCountdown") return 7;
  if (slot === "end" || slot === "reveal") return 3;
  return 20;
}

/**
 * Renders a built-in slot offline (for its waveform): the same synthesis,
 * into an OfflineAudioContext. Countdowns as the usual 5 s.
 */
export async function renderBuiltin(
  skinId: BuiltinSkinId,
  slot: SoundSlot,
): Promise<AudioBuffer | null> {
  if (typeof OfflineAudioContext === "undefined") return null;
  const seconds = builtinRenderSec(slot);
  const rate = 22050;
  const ctx = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
  rendering = { ctx, seconds };
  try {
    playBuiltin(skinId, slot, { volume: 0.45, remainingMs: 5000 });
  } finally {
    rendering = null;
  }
  return ctx.startRendering();
}

/** When the built-in tusch hits (after its drum roll / fall), in ms. */
export const builtinTuschZeroMs = (skinId: BuiltinSkinId) =>
  skinId === "builtin:arcade" ? 300 : 500;

/** A built-in loop with "repeat" off plays this many bars. */
export const BUILTIN_PASS_BARS = 8;

/** A short, bright two-note "ping" (a player joined the waiting room). */
export function playPing(volume = 0.35) {
  const ctx = audioContext();
  if (!ctx) return;
  const bus = ctx.createGain();
  bus.gain.value = volume;
  bus.connect(ctx.destination);
  const t = ctx.currentTime + 0.01;
  tone(ctx, bus, t, hz(15), 0.18, "sine", 0.5, 9000); // C6
  tone(ctx, bus, t + 0.09, hz(22), 0.35, "sine", 0.45, 9000); // G6
  later(() => bus.disconnect(), 800);
}

/** Half the ping's level: the lobby's bubble pops and reactions are frequent. */
const SOFT = 0.5;

/** A soft "blopp" (a player popped a bubble): a quick downward sine drop. */
export function playBlopp(volume = 0.35 * SOFT) {
  const ctx = audioContext();
  if (!ctx) return;
  const t = ctx.currentTime + 0.01;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  const f0 = 520 + Math.random() * 160;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.35, t + 0.09);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.15);
}

/** A light, high "pling" (a player sent a reaction). */
export function playPling(volume = 0.35 * SOFT) {
  const ctx = audioContext();
  if (!ctx) return;
  const bus = ctx.createGain();
  bus.gain.value = volume;
  bus.connect(ctx.destination);
  const t = ctx.currentTime + 0.01;
  const f = hz(27 + Math.floor(Math.random() * 3) * 2); // C7..E7
  tone(ctx, bus, t, f, 0.3, "triangle", 0.5, 12000);
  tone(ctx, bus, t, f * 2, 0.15, "sine", 0.15, 12000);
  later(() => bus.disconnect(), 600);
}

// -- 8-bit effects (Arcade skin) -------------------------------------------------
// Square-wave chirps like an old console's pickups: short, bright, rising.

/** One 8-bit note: square wave, hard attack, quick decay. */
function chip(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  dur: number,
  level: number,
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(level, t);
  g.gain.setValueAtTime(level, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function chipBus(volume: number) {
  const ctx = audioContext();
  if (!ctx) return null;
  const bus = ctx.createGain();
  bus.gain.value = volume;
  bus.connect(ctx.destination);
  later(() => bus.disconnect(), 1200);
  return { ctx, bus, t: ctx.currentTime + 0.01 };
}

/** Arcade join: a pickup "pling-pling" — two quick notes, then one ringing a fifth up. */
export function playArcadeJoin(volume = 0.16) {
  const c = chipBus(volume);
  if (!c) return;
  chip(c.ctx, c.bus, c.t, hz(15), 0.05, 0.5); // C6
  chip(c.ctx, c.bus, c.t + 0.06, hz(15), 0.05, 0.5); // C6
  chip(c.ctx, c.bus, c.t + 0.12, hz(22), 0.28, 0.5); // G6
}

/** Arcade bubble: a tiny blip that jumps up. */
export function playArcadeBlopp(volume = 0.08) {
  const c = chipBus(volume);
  if (!c) return;
  const base = 10 + Math.floor(Math.random() * 4);
  chip(c.ctx, c.bus, c.t, hz(base), 0.035, 0.5);
  chip(c.ctx, c.bus, c.t + 0.035, hz(base + 12), 0.05, 0.4);
}

/** Arcade reaction: a quick rising three-note arpeggio. */
export function playArcadePling(volume = 0.045) {
  const c = chipBus(volume);
  if (!c) return;
  const root = 19 + Math.floor(Math.random() * 3) * 2;
  [0, 4, 7].forEach((step, i) =>
    chip(c.ctx, c.bus, c.t + i * 0.045, hz(root + step), 0.07, 0.45),
  );
}

/** A soft bus for Chill's cues: warm, low-passed, quiet. */
function softBus(volume: number) {
  const ctx = audioContext();
  if (!ctx) return null;
  const bus = ctx.createGain();
  bus.gain.value = volume;
  bus.connect(ctx.destination);
  later(() => bus.disconnect(), 1500);
  return { ctx, bus, t: ctx.currentTime + 0.01 };
}

/** Chill join: two mellow notes a sixth apart, slowly ringing out. */
export function playChillJoin(volume = 0.3) {
  const c = softBus(volume);
  if (!c) return;
  tone(c.ctx, c.bus, c.t, hz(7), 0.5, "triangle", 0.4, 2400); // G5
  tone(c.ctx, c.bus, c.t + 0.14, hz(16), 0.8, "sine", 0.35, 2400); // E6
}

/** Chill bubble: a low, round drop. */
export function playChillBlopp(volume = 0.12) {
  const ctx = audioContext();
  if (!ctx) return;
  const t = ctx.currentTime + 0.01;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  const f0 = 300 + Math.random() * 90;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.16);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.25);
}

/** Chill reaction: a soft chime. */
export function playChillPling(volume = 0.1) {
  const c = softBus(volume);
  if (!c) return;
  const f = hz(19 + Math.floor(Math.random() * 3) * 2);
  tone(c.ctx, c.bus, c.t, f, 0.6, "sine", 0.5, 5000);
  tone(c.ctx, c.bus, c.t, f * 1.5, 0.4, "triangle", 0.12, 5000);
}

/**
 * A lobby cue in a built-in skin's variant; `scale` 1 = its usual level
 * (the skin's volume option: 80 → 1).
 */
export function playCue(skinId: BuiltinSkinId, cue: CueSlot, scale = 1) {
  if (skinId === "builtin:arcade") {
    if (cue === "join") playArcadeJoin(0.16 * scale);
    else if (cue === "bubble") playArcadeBlopp(0.08 * scale);
    else playArcadePling(0.045 * scale);
  } else if (skinId === "builtin:chill") {
    if (cue === "join") playChillJoin(0.3 * scale);
    else if (cue === "bubble") playChillBlopp(0.12 * scale);
    else playChillPling(0.1 * scale);
  } else {
    if (cue === "join") playPing(0.35 * scale);
    else if (cue === "bubble") playBlopp(0.35 * SOFT * scale);
    else playPling(0.35 * SOFT * scale);
  }
}

/** 8-bit kick: a triangle wave swept down fast. */
function chipKick(ctx: AudioContext, out: AudioNode, t: number, level: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
  g.gain.setValueAtTime(Math.max(0.0001, level), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.14);
}
