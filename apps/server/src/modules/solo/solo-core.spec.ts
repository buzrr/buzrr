import { describe, expect, it } from "vitest";
import type { LiveQuestion } from "../question-types";
import { judgeSoloAnswer, soloRank, soloReveal } from "./solo-core";

const question: LiveQuestion = {
  id: "q",
  type: "multiple_choice",
  title: "Two plus two?",
  media: null,
  mediaType: null,
  timeOut: 20,
  options: [
    { id: "a", title: "4", isCorrect: true },
    { id: "b", title: "5", isCorrect: false },
  ],
  config: { multiSelect: false },
};
const start = 1_000_000;

describe("play alone", () => {
  it("scores a right answer by the server's time from the question's own start", () => {
    const fast = judgeSoloAnswer(
      question,
      0,
      start,
      { optionId: "a" },
      start + 1000,
    );
    const slow = judgeSoloAnswer(
      question,
      0,
      start,
      { optionId: "a" },
      start + 15000,
    );
    expect(fast.kind).toBe("ok");
    expect(slow.kind).toBe("ok");
    if (fast.kind !== "ok" || slow.kind !== "ok") return;
    expect(fast.row).toMatchObject({ isCorrect: true, timeTakenMs: 1000 });
    expect(fast.row.score).toBeGreaterThan(slow.row.score);
  });

  it("gives a wrong answer no points", () => {
    const j = judgeSoloAnswer(
      question,
      0,
      start,
      { optionId: "b" },
      start + 500,
    );
    expect(j.kind === "ok" && j.row).toMatchObject({
      isCorrect: false,
      score: 0,
    });
  });

  it("turns an answer after the time (and the grace) into a miss", () => {
    const j = judgeSoloAnswer(
      question,
      3,
      start,
      { optionId: "a" },
      start + 21000,
    );
    expect(j).toEqual({
      kind: "late",
      row: {
        qIndex: 3,
        answer: null,
        timeTakenMs: 20000,
        isCorrect: false,
        score: 0,
      },
    });
  });

  it("refuses an answer the question can't take", () => {
    expect(
      judgeSoloAnswer(question, 0, start, { optionId: "x" }, start).kind,
    ).toBe("invalid");
  });

  it("reveals the solution in the live game's shapes", () => {
    const { you, reveal } = soloReveal(
      question,
      {
        qIndex: 2,
        answer: null,
        timeTakenMs: 20000,
        isCorrect: false,
        score: 0,
      },
      900,
    );
    expect(you).toMatchObject({ answered: false, totalScore: 900, rank: null });
    expect(reveal).toMatchObject({
      index: 2,
      summary: { type: "multiple_choice", correctOptionIds: ["a"] },
    });
  });

  it("ranks ties together", () => {
    expect(soloRank(500, [900, 500, 500, 100])).toBe(2);
    expect(soloRank(100, [900, 500, 500, 100])).toBe(4);
  });
});
