/**
 * What a player picked last time, kept in localStorage so the next game
 * starts with it: name + avatar for the profile form, and the three reaction
 * emojis. Browser only; every read tolerates missing or broken values.
 */

const PROFILE_KEY = "buzrr:player-profile";
const EMOJI_KEY = "buzrr:reaction-emojis";

export const DEFAULT_REACTION_EMOJIS = ["👍", "❤️", "😂"];

/** Emojis offered in the reaction picker. */
export const REACTION_EMOJI_CHOICES = [
  "👍", "❤️", "😂", "🔥", "👏", "🎉", "😮", "😍",
  "🤯", "😎", "🥳", "💯", "🙌", "🤩", "😅", "🤔",
  "😢", "😡", "👀", "🚀", "⭐", "🍀", "🍕", "☕",
  "🐱", "🐶", "🦄", "🌈", "⚡", "🏆", "🤝", "✌️",
];

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the next game just starts from the defaults.
  }
}

export function loadPlayerProfile(): { name: string; image: string } | null {
  const p = read<{ name?: unknown; image?: unknown }>(PROFILE_KEY);
  return p && typeof p.name === "string" && typeof p.image === "string"
    ? { name: p.name, image: p.image }
    : null;
}

export function savePlayerProfile(profile: { name: string; image: string }) {
  write(PROFILE_KEY, profile);
}

export function loadReactionEmojis(): string[] {
  const e = read<unknown>(EMOJI_KEY);
  return Array.isArray(e) &&
    e.length === 3 &&
    e.every((x) => typeof x === "string" && x.length > 0 && x.length <= 16)
    ? (e as string[])
    : DEFAULT_REACTION_EMOJIS;
}

export function saveReactionEmojis(emojis: string[]) {
  write(EMOJI_KEY, emojis.slice(0, 3));
}
