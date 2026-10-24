import { createCipheriv, randomBytes } from "node:crypto";

/**
 * Clips are stored and served encrypted (AES-256-GCM): devices may download
 * them early (preloading during the previous question's reveal) but can't
 * play them until the game hands out the key. File layout: 12-byte IV, then
 * the ciphertext with the 16-byte GCM tag appended — what Web Crypto's
 * AES-GCM decrypt expects.
 */
export function encryptClip(clip: Buffer): { blob: Buffer; key: string } {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(clip), cipher.final()]);
  return {
    blob: Buffer.concat([iv, body, cipher.getAuthTag()]),
    key: key.toString("base64url"),
  };
}
