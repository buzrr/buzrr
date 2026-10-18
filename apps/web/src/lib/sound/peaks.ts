"use client";

const BARS = 480;

/** Peak per bar (0..1) of the decoded audio, for the waveform. */
export async function decodePeaks(
  src: string,
): Promise<{ peaks: number[]; durationMs: number }> {
  const buf = await (await fetch(src)).arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(buf);
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
  } finally {
    void ctx.close();
  }
}
