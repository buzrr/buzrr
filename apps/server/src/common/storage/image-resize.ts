import { runFfmpeg } from "./audio-transcode";
import { sniffImage } from "./image-sniff";

/** Question pictures: longest side as every device loads them. */
export const QUESTION_IMAGE_MAX = 1600;

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

/** Whether a picture has any transparent pixel (checked on a small copy). */
async function hasAlpha(input: Buffer): Promise<boolean> {
  const rgba = await runFfmpeg(input, [
    "-i",
    "pipe:0",
    "-vf",
    "scale=64:-1,format=rgba",
    "-frames:v",
    "1",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i]! < 255) return true;
  }
  return false;
}

/** The MIME type of a stored picture (after `shrinkImage`). */
export function imageType(buffer: Buffer): string {
  return sniffImage(buffer).type;
}

/**
 * A picture scaled down to `maxSide` on its longest side — what every
 * device in a room downloads — as JPEG, or PNG when it has transparency:
 * formats every browser shows (WebP needs Safari 14 on macOS 11 / iOS 14).
 * A GIF (maybe animated) passes through, as does anything ffmpeg can't read
 * or a result that isn't smaller — except WebP / AVIF, which are always
 * converted.
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
    const png = ext !== "jpg" && (await hasAlpha(input));
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
      ...(png
        ? ["-c:v", "png", "-f", "image2pipe"]
        : [
            "-c:v",
            "mjpeg",
            "-q:v",
            "4",
            "-pix_fmt",
            "yuvj420p",
            "-f",
            "image2pipe",
          ]),
      "pipe:1",
    ]);
    const mustConvert = ext === "webp" || ext === "avif";
    return mustConvert || out.length < input.length ? out : input;
  } catch {
    return input;
  }
}
