"use client";

const BARS = 480;

export interface Wave {
  /** Peak per bar, 0..1. */
  peaks: number[];
  durationMs: number;
}

/** Peaks of decoded audio, normalised to the loudest bar. */
function peaksOf(audio: AudioBuffer): Wave {
  const data = audio.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / BARS));
  const peaks: number[] = [];
  for (let i = 0; i < BARS; i++) {
    let max = 0;
    const from = i * step;
    for (let j = from; j < Math.min(data.length, from + step); j++) {
      const v = Math.abs(data[j]!);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  const top = Math.max(...peaks, 0.001);
  return {
    peaks: peaks.map((p) => p / top),
    durationMs: Math.round(audio.duration * 1000),
  };
}

/** Peak per bar (0..1) of the decoded audio, for the waveform. */
export async function decodePeaks(src: string): Promise<Wave> {
  const buf = await (await fetch(src)).arrayBuffer();
  const ctx = new AudioContext();
  try {
    return peaksOf(await ctx.decodeAudioData(buf));
  } finally {
    void ctx.close();
  }
}
