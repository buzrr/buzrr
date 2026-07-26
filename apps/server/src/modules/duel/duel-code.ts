import { customAlphabet } from "nanoid";

/** Ambiguity-free alphabet — no I/L/O/0/1, so codes survive being read aloud. */
const nanoid = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 5);

/**
 * Duel room codes are `D` + 5 chars, which keeps them visually distinct from
 * the 6-char hosted-room codes and satisfies the socket handshake's
 * `/^[a-zA-Z0-9_-]{4,20}$/` check.
 */
export function generateDuelCode(): string {
  return `D${nanoid()}`;
}

/** Matches what {@link generateDuelCode} produces — used to validate params. */
export const DUEL_CODE_PATTERN = /^D[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;
