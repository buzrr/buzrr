import { customAlphabet } from "nanoid";

/** Ambiguity-free alphabet — no I/L/O/0/1, so codes survive being read aloud. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const nanoid = customAlphabet(ALPHABET, 5);
const inviteNanoid = customAlphabet(ALPHABET, 13);

/**
 * Matchmade duel codes. Short is safe: the code grants nothing on its own,
 * because the socket gate requires the user to already be in the Redis roster.
 */
export function generateDuelCode(): string {
  return `D${nanoid()}`;
}

/**
 * Invite codes are bearer tokens — whoever holds one can claim the duel — so
 * they get 13 chars ≈ 64 bits to make enumeration infeasible. Only ever shared
 * as a link or QR, never typed.
 */
export function generateDuelInviteCode(): string {
  return `D${inviteNanoid()}`;
}

export const DUEL_INVITE_CODE_PATTERN = new RegExp(`^D[${ALPHABET}]{13}$`);
