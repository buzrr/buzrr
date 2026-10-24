/**
 * What a player picked last time, kept in localStorage so the next game
 * starts with it: the player's own reaction emojis. Browser only; every read
 * tolerates missing or broken values.
 */

const EMOJI_KEY = "buzrr:custom-reactions";

/** The fixed reactions every player has. */
export const BASE_REACTION_EMOJIS = ["👍", "❤️", "😂"];
/** How many own reactions a player can add next to the base ones. */
export const MAX_CUSTOM_REACTIONS = 4;

/** Emojis offered in the reaction picker. */
export const REACTION_EMOJI_CHOICES = [
  "👍",
  "❤️",
  "😂",
  "🔥",
  "👏",
  "🎉",
  "😮",
  "😍",
  "🤯",
  "😎",
  "🥳",
  "💯",
  "🙌",
  "🤩",
  "😅",
  "🤔",
  "😢",
  "😡",
  "👀",
  "🚀",
  "⭐",
  "🍀",
  "🍕",
  "☕",
  "🐱",
  "🐶",
  "🦄",
  "🌈",
  "⚡",
  "🏆",
  "🤝",
  "✌️",
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

/** The player's own reactions (0–4), shown after the base ones. */
export function loadCustomReactions(): string[] {
  const e = read<unknown>(EMOJI_KEY);
  return Array.isArray(e)
    ? e
        .filter(
          (x): x is string =>
            typeof x === "string" && x.length > 0 && x.length <= 16,
        )
        .slice(0, MAX_CUSTOM_REACTIONS)
    : [];
}

export function saveCustomReactions(emojis: string[]) {
  write(EMOJI_KEY, emojis.slice(0, MAX_CUSTOM_REACTIONS));
}
