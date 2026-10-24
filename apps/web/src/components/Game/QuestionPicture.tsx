"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { decryptClipBuffer } from "@/lib/sound/preload";

/** The image type from its first bytes (decrypted blobs carry none). */
function sniffImage(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[8] === 0x57 && bytes[9] === 0x45) return "image/webp";
  return "image/svg+xml";
}

/**
 * A question's picture. Encrypted (`mediaKey`): it was downloaded ahead of
 * the question and is decrypted here, now that the key has come with
 * `question-start`; otherwise the plain file.
 */
export default function QuestionPicture({
  media,
  mediaKey,
  alt,
  className,
  width,
  height,
}: {
  media: string;
  mediaKey?: string;
  alt: string;
  className?: string;
  width: number;
  height: number;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!mediaKey) return;
    let url: string | null = null;
    let alive = true;
    decryptClipBuffer(media, mediaKey)
      .then((buf) => {
        if (!alive) return;
        const bytes = new Uint8Array(buf);
        url = URL.createObjectURL(
          new Blob([bytes], { type: sniffImage(bytes) }),
        );
        setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [media, mediaKey]);

  if (!mediaKey) {
    return (
      <Image
        src={media}
        className={className}
        alt={alt}
        height={height}
        width={width}
      />
    );
  }
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a decrypted blob
    <img
      src={src}
      className={className}
      alt={alt}
      height={height}
      width={width}
    />
  );
}
