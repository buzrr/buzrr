import type { Locale } from "@/lib/i18n/locale";

// Friendly guest names (adjective + animal) for players who don't want to
// think of one. Letters only, so they pass the name rule (and the filter).

const NAMES: Record<Locale, { adjectives: string[]; animals: string[] }> = {
  en: {
    adjectives: [
      "Brave",
      "Clever",
      "Happy",
      "Swift",
      "Lucky",
      "Sunny",
      "Mighty",
      "Jolly",
      "Bold",
      "Calm",
      "Cosmic",
      "Daring",
      "Fuzzy",
      "Gentle",
      "Witty",
      "Zippy",
      "Shiny",
      "Sneaky",
      "Rapid",
      "Quiet",
      "Wise",
      "Funky",
      "Epic",
      "Bouncy",
    ],
    animals: [
      "Otter",
      "Panda",
      "Fox",
      "Koala",
      "Tiger",
      "Falcon",
      "Dolphin",
      "Owl",
      "Lynx",
      "Badger",
      "Penguin",
      "Gecko",
      "Llama",
      "Raccoon",
      "Hedgehog",
      "Moose",
      "Puffin",
      "Squirrel",
      "Turtle",
      "Walrus",
      "Yak",
      "Zebra",
    ],
  },
  de: {
    adjectives: [
      "Mutiger",
      "Schlauer",
      "Flinker",
      "Froher",
      "Wilder",
      "Kluger",
      "Lustiger",
      "Starker",
      "Tapferer",
      "Cooler",
      "Kecker",
      "Sonniger",
      "Stiller",
      "Schneller",
      "Weiser",
      "Frecher",
      "Bunter",
      "Wacher",
    ],
    animals: [
      "Otter",
      "Panda",
      "Fuchs",
      "Koala",
      "Tiger",
      "Falke",
      "Delfin",
      "Uhu",
      "Luchs",
      "Dachs",
      "Pinguin",
      "Gecko",
      "Igel",
      "Elch",
      "Biber",
      "Hamster",
      "Seehund",
      "Waschbaer",
      "Eisvogel",
      "Steinbock",
    ],
  },
};

const pick = <T>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)]!;

/** A random "BraveOtter" / "MutigerOtter" (letters only, ≤ 30). */
export function randomPlayerName(locale: Locale): string {
  const { adjectives, animals } = NAMES[locale] ?? NAMES.en;
  return `${pick(adjectives)}${pick(animals)}`;
}
