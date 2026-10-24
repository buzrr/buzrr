import { spawn } from "node:child_process";
import { UnsupportedMediaError } from "./media-storage";
import { sniffAudio } from "./image-sniff";

/** Audio containers we hand to ffmpeg, by magic bytes. */
const CONVERTIBLE: { name: string; test: (b: Buffer) => boolean }[] = [
  {
    name: "WAV",
    test: (b) =>
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WAVE",
  },
  { name: "Ogg/Opus", test: (b) => b.toString("ascii", 0, 4) === "OggS" },
  { name: "FLAC", test: (b) => b.toString("ascii", 0, 4) === "fLaC" },
  {
    name: "M4A/AAC",
    test: (b) =>
      b.toString("ascii", 4, 8) === "ftyp" &&
      ["M4A ", "M4B ", "mp42", "isom", "dash"].includes(
        b.toString("ascii", 8, 12),
      ),
  },
  // Raw AAC (ADTS): 12-bit sync 0xFFF with layer bits 00.
  {
    name: "AAC",
    test: (b) => b[0] === 0xff && (b[1]! & 0xf6) === 0xf0,
  },
  {
    name: "WebM",
    test: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  },
];

const TRANSCODE_TIMEOUT_MS = 60_000;
const MAX_OUTPUT = 40 * 1024 * 1024;

function isMp3(buffer: Buffer): boolean {
  try {
    sniffAudio(buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Questions and sound skins store MP3 only. An MP3 passes through untouched;
 * WAV, Ogg/Opus, FLAC, M4A/AAC and WebM audio are re-encoded with ffmpeg
 * (stdin → stdout, no temp files, audio only, metadata dropped). Anything
 * else is refused. Needs `ffmpeg` on the PATH (the server image has it).
 */
export async function toMp3(buffer: Buffer): Promise<Buffer> {
  if (isMp3(buffer)) return buffer;
  if (!CONVERTIBLE.some((c) => c.test(buffer))) {
    throw new UnsupportedMediaError(
      "Only MP3, WAV, OGG/Opus, FLAC, M4A/AAC or WebM audio can be uploaded",
    );
  }
  return runFfmpeg(buffer, [
    "-i",
    "pipe:0",
    "-vn",
    "-map_metadata",
    "-1",
    "-codec:a",
    "libmp3lame",
    "-q:a",
    "4",
    "-f",
    "mp3",
    "pipe:1",
  ]);
}

/** Bit rate of the clips devices load (mono). */
// Mono clips at 64 kbit/s: music stays fine, and a full room downloads a third
// less than at 96k (existing clips keep their rate until re-uploaded).
const CLIP_BITRATE = "64k";

/**
 * The `durationMs` from `startMs` of an MP3, re-encoded small (mono,
 * 96 kbit/s) — what players' devices download instead of the whole file.
 */
export async function cutClip(
  mp3: Buffer,
  startMs: number,
  durationMs: number,
): Promise<Buffer> {
  return runFfmpeg(mp3, [
    "-ss",
    (startMs / 1000).toFixed(3),
    "-t",
    (durationMs / 1000).toFixed(3),
    "-i",
    "pipe:0",
    "-vn",
    "-map_metadata",
    "-1",
    "-ac",
    "1",
    "-codec:a",
    "libmp3lame",
    "-b:a",
    CLIP_BITRATE,
    "-f",
    "mp3",
    "pipe:1",
  ]);
}

/**
 * A whole MP3 re-encoded small (mono, CLIP_BITRATE) — the copy of a sound
 * skin file that players' devices load; the host plays the original.
 */
export async function toPlayerMp3(mp3: Buffer): Promise<Buffer> {
  return runFfmpeg(mp3, [
    "-i",
    "pipe:0",
    "-vn",
    "-map_metadata",
    "-1",
    "-ac",
    "1",
    "-codec:a",
    "libmp3lame",
    "-b:a",
    CLIP_BITRATE,
    "-f",
    "mp3",
    "pipe:1",
  ]);
}

/** Runs ffmpeg on `input` (stdin → stdout, no temp files) with a timeout and an output cap. */
export function runFfmpeg(input: Buffer, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", ...args],
      {
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    const fail = (message: string) => {
      if (failed) return;
      failed = true;
      ff.kill("SIGKILL");
      reject(new UnsupportedMediaError(message));
    };
    const timer = setTimeout(
      () => fail("Converting the audio took too long"),
      TRANSCODE_TIMEOUT_MS,
    );
    ff.stdout.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_OUTPUT) fail("The converted audio is too large");
      else chunks.push(c);
    });
    ff.on("error", () => {
      clearTimeout(timer);
      fail("This server can't convert audio (ffmpeg missing) — upload an MP3");
    });
    ff.on("close", (code) => {
      clearTimeout(timer);
      if (failed) return;
      if (code !== 0 || size === 0) {
        fail("Could not read this audio file");
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    ff.stdin.on("error", () => undefined);
    ff.stdin.end(input);
  });
}
