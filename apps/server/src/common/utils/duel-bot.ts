import { nanoid } from "nanoid";
import type { LiveQuestion } from "../../modules/game-engine/game-engine.types";
import { ELO_FLOOR } from "./elo";

export type BotTier = "easy" | "medium" | "hard";

interface BotProfile {
  /** P(correct); delay fractions are of the question's timeOut. */
  accuracy: number;
  minDelayFrac: number;
  maxDelayFrac: number;
}

/** Expected totals over 7x15s questions: easy ~1300, medium ~2700, hard ~4650. */
const BOT_PROFILES: Record<BotTier, BotProfile> = {
  easy: { accuracy: 0.45, minDelayFrac: 0.5, maxDelayFrac: 0.8 },
  medium: { accuracy: 0.7, minDelayFrac: 0.35, maxDelayFrac: 0.65 },
  hard: { accuracy: 0.88, minDelayFrac: 0.15, maxDelayFrac: 0.4 },
};

const BOT_ELO_JITTER = 75;
/** Never answer instantly — an inhuman reaction time gives the bot away. */
const MIN_ANSWER_DELAY_MS = 800;
/** Keeps the answer clear of the deadline so it is never rejected as late. */
const DEADLINE_MARGIN_MS = 500;

const BOT_NAMES = [
  "Aarav",
  "Nikhil",
  "Sana",
  "Riya M",
  "quizfox",
  "Dev Patel",
  "Meera",
  "Tanmay",
  "Ishita",
  "arjun_99",
  "Kabir",
  "Priya S",
  "Rohan",
  "Zoya",
  "Ananya",
  "Vihaan",
  "trivia_sam",
  "Neha",
  "Aditya",
  "Kavya",
  "Manav",
  "Diya",
  "Rahul K",
  "Simran",
  "Yash",
  "pixelninja",
  "Aisha",
  "Karan",
  "Nandini",
  "Siddharth",
];

export interface BotOpponent {
  id: string;
  name: string;
  profilePic: null;
  elo: number;
  tier: BotTier;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function pickBotTier(elo: number): BotTier {
  if (elo < 1100) return "easy";
  if (elo < 1400) return "medium";
  return "hard";
}

/**
 * The bot mirrors the player's rating (plus jitter) so the ELO swing is
 * comparable at every rung of the ladder. The `bot_` id prefix can never
 * collide with a User id, which is what keeps it out of the ELO lookup.
 */
export function createBotOpponent(humanElo: number): BotOpponent {
  const elo = Math.max(
    ELO_FLOOR,
    humanElo + randomInt(-BOT_ELO_JITTER, BOT_ELO_JITTER),
  );
  return {
    id: `bot_${nanoid(10)}`,
    name: pick(BOT_NAMES),
    profilePic: null,
    elo,
    tier: pickBotTier(humanElo),
  };
}

/**
 * The bot always answers — a "miss" is a wrong option rather than silence, so
 * maybeRevealEarly() can still close the question once both players are in.
 */
export function planBotAnswer(
  question: LiveQuestion,
  tier: BotTier,
): { optionId: string; delayMs: number } {
  const profile = BOT_PROFILES[tier];
  const correct = question.options.filter((o) => o.isCorrect);
  const incorrect = question.options.filter((o) => !o.isCorrect);

  let pool = Math.random() < profile.accuracy ? correct : incorrect;
  // A question with no wrong option (or no right one) still needs an answer.
  if (pool.length === 0) pool = question.options;

  const limitMs = question.timeOut * 1000;
  const frac =
    profile.minDelayFrac +
    Math.random() * (profile.maxDelayFrac - profile.minDelayFrac);
  const delayMs = Math.min(
    Math.max(Math.round(limitMs * frac), MIN_ANSWER_DELAY_MS),
    Math.max(limitMs - DEADLINE_MARGIN_MS, 0),
  );

  return { optionId: pick(pool).id, delayMs };
}
