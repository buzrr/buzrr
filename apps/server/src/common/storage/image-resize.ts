import { runFfmpeg } from "./audio-transcode";

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
