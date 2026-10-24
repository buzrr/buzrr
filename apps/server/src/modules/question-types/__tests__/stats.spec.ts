import { describe, expect, it } from "vitest";
import type { QuestionAnswer } from "@buzrr/contract";
import type { LiveQuestion } from "../question-type";
import { questionStats } from "../stats";

const base = {
  id: "q",
  title: "Question?",
  media: null,
  mediaType: null,
  timeOut: 20,
};

const entries = (answers: QuestionAnswer[]) =>
  answers.map((answer) => ({ answer, author: null }));

describe("questionStats", () => {
  it("counts right answers and averages the time (multiple choice)", () => {
    const live: LiveQuestion = {
      ...base,
      type: "multiple_choice",
      options: [
        { id: "a", title: "A", isCorrect: true },
        { id: "b", title: "B", isCorrect: false },
        { id: "c", title: "C", isCorrect: false },
      ],
      config: { multiSelect: false },
    };
    const stats = questionStats(
      live,
      2,
      entries([{ optionId: "a" }, { optionId: "c" }, { optionId: "c" }]),
      [1000, 2000, 4000],
    );
    expect(stats).toMatchObject({
      index: 2,
      type: "multiple_choice",
      responses: 3,
      correct: 1,
      avgTimeMs: 2333,
      options: [
        { id: "a", title: "A", isCorrect: true },
        { id: "b", title: "B", isCorrect: false },
        { id: "c", title: "C", isCorrect: false },
      ],
    });
    expect(stats.summary).toMatchObject({ counts: [1, 0, 2] });
  });

  it("has no right answers for an unscored type, and no time without answers", () => {
    const live: LiveQuestion = {
      ...base,
      type: "poll",
      options: [
        { id: "x", title: "X", isCorrect: false },
        { id: "y", title: "Y", isCorrect: false },
      ],
      config: { multiSelect: false },
    };
    const stats = questionStats(live, 0, [], []);
    expect(stats.correct).toBeNull();
    expect(stats.responses).toBe(0);
    expect(stats.avgTimeMs).toBeNull();
  });

  it("keeps a picture, not other media", () => {
    const live: LiveQuestion = {
      ...base,
      type: "true_false",
      media: "https://img",
      mediaType: "image",
      options: [],
      config: { answer: true },
    };
    const stats = questionStats(live, 0, entries([{ value: false }]), [500]);
    expect(stats.image).toBe("https://img");
    expect(stats.correct).toBe(0);
    expect(
      questionStats({ ...live, mediaType: "audio" }, 0, [], []).image,
    ).toBeNull();
  });
});
