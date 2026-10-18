import { runFfmpeg } from "./audio-transcode";
import { sniffImage } from "./image-sniff";

/** Avatar pictures are stored square at this size (PNG). */
export const AVATAR_SIZE = 256;

/**
 * Any picture ffmpeg reads (PNG, JPEG, WebP, GIF, …) as a square PNG avatar:
 * scaled to cover, centre-cropped, first frame only.
 */
export function toAvatarPng(input: Buffer): Promise<Buffer> {
  return runFfmpeg(input, [
    "-i",
    "pipe:0",
    "-vf",
    `scale=${AVATAR_SIZE}:${AVATAR_SIZE}:force_original_aspect_ratio=increase,crop=${AVATAR_SIZE}:${AVATAR_SIZE}`,
    "-frames:v",
    "1",
    "-f",
    "image2pipe",
    "-vcodec",
    "png",
    "pipe:1",
  ]);
}

/** Question pictures: longest side as every device loads them. */
export const QUESTION_IMAGE_MAX = 1600;
/** Logos: shown a few hundred pixels wide at most. */
export const LOGO_MAX = 512;

/**
 * A JPEG's EXIF orientation (1 = as stored), so the picture can be turned
 * the way phones mean it: ffmpeg's own handling differs between versions,
 * so it is switched off and done here.
 */
export function jpegOrientation(buf: Buffer): number {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return 1;
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1]!;
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xe1 && buf.toString("ascii", i + 4, i + 8) === "Exif") {
      const t = i + 10;
      const le = buf.toString("ascii", t, t + 2) === "II";
      const u16 = (o: number) =>
        le ? buf.readUInt16LE(o) : buf.readUInt16BE(o);
      const u32 = (o: number) =>
        le ? buf.readUInt32LE(o) : buf.readUInt32BE(o);
      const ifd = t + u32(t + 4);
      const n = u16(ifd);
      for (let e = 0; e < n; e++) {
        const at = ifd + 2 + e * 12;
        if (at + 12 > buf.length) break;
        if (u16(at) === 0x0112) return u16(at + 8);
      }
      return 1;
    }
    if (marker === 0xda) break; // image data: no EXIF before it
    i += 2 + len;
  }
  return 1;
}

/** ffmpeg filters that turn a picture upright for an EXIF orientation. */
const UPRIGHT: Record<number, string> = {
  2: "hflip",
  3: "hflip,vflip",
  4: "vflip",
  5: "transpose=0",
  6: "transpose=1",
  7: "transpose=3",
  8: "transpose=2",
};

/**
 * A picture scaled down to `maxSide` on its longest side, as WebP (which
 * keeps transparency) — what every device in a room downloads. A GIF (maybe
 * animated) passes through, as does anything ffmpeg can't read or a result
 * that isn't smaller.
 */
export async function shrinkImage(
  input: Buffer,
  maxSide: number,
): Promise<Buffer> {
  let ext: string;
  try {
    ext = sniffImage(input).ext;
  } catch {
    return input;
  }
  if (ext === "gif") return input;
  const upright = ext === "jpg" ? UPRIGHT[jpegOrientation(input)] : undefined;
  const scale = `scale='min(${maxSide},iw)':'min(${maxSide},ih)':force_original_aspect_ratio=decrease`;
  try {
    const out = await runFfmpeg(input, [
      "-noautorotate",
      "-i",
      "pipe:0",
      "-vf",
      upright ? `${upright},${scale}` : scale,
      "-frames:v",
      "1",
      "-map_metadata",
      "-1",
      "-c:v",
      "libwebp",
      "-quality",
      "80",
      "-f",
      "webp",
      "pipe:1",
    ]);
    return out.length < input.length ? out : input;
  } catch {
    return input;
  }
}
