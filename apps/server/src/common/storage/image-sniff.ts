import { UnsupportedMediaError } from "./media-storage";

/**
 * The raster image formats stores that serve bytes as-is (local disk, S3)
 * accept, identified by magic bytes — never by the client's Content-Type or
 * filename. SVG is deliberately absent: it can carry script, and these stores
 * serve from an origin we control.
 */
const SIGNATURES: {
  type: string;
  ext: string;
  test: (b: Buffer) => boolean;
}[] = [
  {
    type: "image/png",
    ext: "png",
    test: (b) =>
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    type: "image/jpeg",
    ext: "jpg",
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: "image/gif",
    ext: "gif",
    test: (b) => ["GIF87a", "GIF89a"].includes(b.toString("ascii", 0, 6)),
  },
  {
    type: "image/webp",
    ext: "webp",
    test: (b) =>
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
  {
    type: "image/avif",
    ext: "avif",
    test: (b) =>
      b.toString("ascii", 4, 8) === "ftyp" &&
      ["avif", "avis"].includes(b.toString("ascii", 8, 12)),
  },
];

export function sniffImage(buffer: Buffer): { type: string; ext: string } {
  const match = SIGNATURES.find((s) => s.test(buffer));
  if (!match) {
    throw new UnsupportedMediaError(
      "Only PNG, JPEG, GIF, WebP or AVIF images can be uploaded",
    );
  }
  return { type: match.type, ext: match.ext };
}
