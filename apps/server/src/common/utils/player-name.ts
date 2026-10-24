// Guest display names: what a name may contain, and names that may not
// appear on a host's projected screen. Checked on the server (create and
// rename); the join form's own check is only a convenience.

export const PLAYER_NAME_MAX = 30;

/** Letters, digits and `_`, at most 30 — the rule the join form applies. */
export function cleanPlayerName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, "").slice(0, PLAYER_NAME_MAX);
}

/**
 * Offensive roots (English and German), matched inside a name once leetspeak
 * and repeated letters are undone. Kept to roots long or specific enough not
 * to hit ordinary words.
 */
const ROOTS = [
  // English
  "fuck",
  "fuk",
  "fck",
  "shit",
  "bitch",
  "cunt",
  "whore",
  "slut",
  "pussy",
  "penis",
  "vagina",
  "bastard",
  "wanker",
  "twat",
  "bollock",
  "asshole",
  "arsehole",
  "jackass",
  "dumbass",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "raping",
  "hitler",
  "porn",
  "cumshot",
  "dildo",
  "blowjob",
  "handjob",
  "motherf",
  // German
  "fick",
  "fotze",
  "nutte",
  "schlampe",
  "wichser",
  "wixer",
  "arschloch",
  "arschgeige",
  "hurensohn",
  "missgeburt",
  "schwuchtel",
  "neger",
  "kanake",
  "pimmel",
  "muschi",
  "titten",
  "vergewalt",
  "siegheil",
];

/**
 * Short or common roots, offensive only as a whole word of the name (so
 * "Cassandra", "Hancock" and "Therapist" stay fine): the name's words split
 * at `_` and lower-to-upper case changes.
 */
const WORDS = [
  "ass",
  "arse",
  "fag",
  "cum",
  "sex",
  "anal",
  "piss",
  "dick",
  "cock",
  "tits",
  "boob",
  "boobs",
  "nazi",
  "rapist",
  "kkk",
  "arsch",
  "hure",
  "spast",
  "sau",
];

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
};

/** Lower case, leetspeak undone, runs of a letter collapsed ("fuuuck"). */
function unleet(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9]/g, (d) => LEET[d] ?? d)
    .replace(/(.)\1+/g, "$1");
}

const collapse = (text: string) => text.replace(/(.)\1+/g, "$1");

/** Whether a (cleaned) name contains something offensive. */
export function isOffensiveName(name: string): boolean {
  const joined = unleet(name.replace(/_/g, ""));
  if (ROOTS.some((r) => joined.includes(collapse(r)))) return true;
  const words = name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[_\s]+/)
    .filter(Boolean);
  // Stretched words count ("Asss"), shortened ones don't ("As").
  return words.some((w) =>
    WORDS.some((x) => w.length >= x.length && unleet(w) === collapse(x)),
  );
}
