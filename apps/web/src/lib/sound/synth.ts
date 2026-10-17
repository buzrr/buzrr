"use client";

import type { SoundSlot } from "@buzrr/contract";

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
}

export const BUILTIN_SKINS: Record<BuiltinSkinId, Palette> = {
  "builtin:show": {
    name: "Game Show",
    bpm: 118,
    lead: "sawtooth",
    bass: "square",
    pad: "sawtooth",
    roots: [-9, -4, -2, -7], // C – F – G – Am (relative to A4)
    scale: [0, 2, 4, 7, 9, 12],
    cutoff: 2600,
    drums: 0.9,
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
  },
};

const LOOP_SLOTS: SoundSlot[] = ["lobby", "question", "scores", "final"];
export const isLoopSlot = (slot: SoundSlot) => LOOP_SLOTS.includes(slot);

let sharedCtx: AudioContext | null = null;
/** One AudioContext for the page; resumed on the first user gesture. */
export function audioContext(): AudioContext | null {
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
  stop: () => void;
}

/**
 * Plays a built-in slot. `progress()` (0..1) lets the question loop build
 * up towards the end of the answer time; `remainingMs` times the countdown.
 */
export function playBuiltin(
  skinId: BuiltinSkinId,
  slot: SoundSlot,
  opts: { volume?: number; progress?: () => number; remainingMs?: number } = {},
): SoundHandle {
  const ctx = audioContext();
  if (!ctx) return { stop: () => undefined };
  const p = BUILTIN_SKINS[skinId] ?? BUILTIN_SKINS["builtin:show"];
  const bus = ctx.createGain();
  bus.gain.value = opts.volume ?? 0.5;
  bus.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.05;
  const beat = 60 / p.bpm;
  const d = p.drums;

  const fadeOut = () => {
    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(0.0001, now + 0.4);
    setTimeout(() => bus.disconnect(), 600);
  };

  // -- one-shots ------------------------------------------------------------
  if (slot === "countdown") {
    const secs = Math.max(1, Math.round((opts.remainingMs ?? 5000) / 1000));
    for (let i = 0; i < secs; i++) {
      tone(
        ctx,
        bus,
        t0 + i,
        hz(p.scale[i % p.scale.length]! + 3),
        0.18,
        p.lead,
        0.3,
        p.cutoff,
      );
      kick(ctx, bus, t0 + i, 0.5 * d);
    }
    chord(ctx, bus, t0 + secs, p.roots[0]! + 12, 0.7, p.pad, 0.12, p.cutoff);
    crash(ctx, bus, t0 + secs, d);
    return { stop: fadeOut };
  }
  if (slot === "end") {
    // Tusch: drum roll, then two chord stabs and a crash.
    for (let i = 0; i < 10; i++) snare(ctx, bus, t0 + i * 0.045, 0.5 * d + 0.2);
    const hit = t0 + 0.5;
    chord(ctx, bus, hit, p.roots[0]!, 0.25, p.pad, 0.13, p.cutoff);
    chord(ctx, bus, hit + 0.3, p.roots[0]! + 12, 1.1, p.pad, 0.15, p.cutoff);
    kick(ctx, bus, hit + 0.3, 0.8);
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
  const tick = () => {
    const ahead = ctx.currentTime + 0.12;
    while (next < ahead) {
      // The question loop gets faster and denser towards the end.
      const prog =
        slot === "question" ? Math.min(1, opts.progress?.() ?? 0) : 0;
      const eighth = beat / 2 / (tempo * (1 + prog * 0.35));
      const bar = Math.floor(step / 8) % p.roots.length;
      const root = p.roots[bar]!;
      const inBar = step % 8;
      const onBeat = inBar % 2 === 0;

      if (party || slot === "question") {
        if (onBeat) kick(ctx, bus, next, 0.7 * d);
        else hat(ctx, bus, next, d);
        if (inBar === 2 || inBar === 6) snare(ctx, bus, next, 0.6 * d);
      } else {
        if (inBar === 0) kick(ctx, bus, next, 0.45 * d);
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
      if (slot === "question" && prog > 0.75 && onBeat) {
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
  tick();
  const timer = setInterval(tick, 40);
  return {
    stop: () => {
      clearInterval(timer);
      fadeOut();
    },
  };
}

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
  setTimeout(() => bus.disconnect(), 800);
}
