import { afterEach, describe, expect, it, vi } from "vitest";
import type { LiveQuestion } from "../../modules/question-types";
import {
  createBotOpponent,
  pickBotTier,
  planBotAnswer,
  type BotTier,
} from "./duel-bot";
import { ELO_FLOOR } from "./elo";

const question: LiveQuestion = {
  id: "q",
  type: "multiple_choice",
  title: "Two plus two?",
  media: null,
  mediaType: null,
  timeOut: 15,
  options: [
    { id: "right", title: "4", isCorrect: true },
    { id: "wrong", title: "5", isCorrect: false },
  ],
  config: { multiSelect: false },
};

afterEach(() => vi.restoreAllMocks());

describe("pickBotTier", () => {
  it("follows the player's rating", () => {
    expect(pickBotTier(800)).toBe("easy");
    expect(pickBotTier(1099)).toBe("easy");
    expect(pickBotTier(1100)).toBe("medium");
    expect(pickBotTier(1399)).toBe("medium");
    expect(pickBotTier(1400)).toBe("hard");
    expect(pickBotTier(2400)).toBe("hard");
  });
});

describe("createBotOpponent", () => {
  it("rates the bot within the jitter of the player, and marks its id", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const low = createBotOpponent(1300);
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const high = createBotOpponent(1300);
    expect(low.elo).toBe(1225);
    expect(high.elo).toBe(1375);
    expect(low.id.startsWith("bot_")).toBe(true);
    expect(low.tier).toBe("medium");
    expect(low.profilePic).toBeNull();
  });

  it("never rates the bot below the floor", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(createBotOpponent(ELO_FLOOR).elo).toBe(ELO_FLOOR);
  });
});

describe("planBotAnswer", () => {
  it("answers right when the roll is under its accuracy, wrong otherwise", () => {
    expect(planBotAnswer(question, "hard", () => 0).answer).toEqual({
      optionId: "right",
    });
    expect(planBotAnswer(question, "easy", () => 0.99).answer).toEqual({
      optionId: "wrong",
    });
  });

  it("answers within its tier's window, never instantly or on the deadline", () => {
    const tiers: BotTier[] = ["easy", "medium", "hard"];
    for (const tier of tiers) {
      for (const r of [0, 0.5, 0.999]) {
        const { delayMs } = planBotAnswer(question, tier, () => r);
        expect(delayMs).toBeGreaterThanOrEqual(800);
        expect(delayMs).toBeLessThanOrEqual(15_000 - 500);
      }
    }
    // Hard is quicker than easy at the same roll.
    expect(planBotAnswer(question, "hard", () => 0.5).delayMs).toBeLessThan(
      planBotAnswer(question, "easy", () => 0.5).delayMs,
    );
  });

  it("keeps clear of a very short deadline", () => {
    const short = { ...question, timeOut: 1 };
    expect(planBotAnswer(short, "easy", () => 0.9).delayMs).toBe(500);
  });
});
