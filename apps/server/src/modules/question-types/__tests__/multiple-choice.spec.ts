import { describe, expect, it } from "vitest";
import { QuestionDefinitionError } from "../question-type";
import {
  checkAnswer,
  normalizeLiveQuestion,
  sampleAnswer,
  scoreAnswer,
  summarizeAnswers,
  toLiveQuestion,
  toPublicQuestion,
  validateDefinition,
} from "../registry";
import type { LiveQuestion } from "../question-type";

const options = (correct: number, count = 4) =>
  Array.from({ length: count }, (_, i) => ({
    title: `Option ${i + 1}`,
    isCorrect: i === correct,
  }));

const live: LiveQuestion = {
  id: "q",
  type: "multiple_choice",
  title: "Capital of France?",
  media: null,
  mediaType: null,
  timeOut: 10,
  options: [
    { id: "a", title: "Paris", isCorrect: true },
    { id: "b", title: "Lyon", isCorrect: false },
    { id: "c", title: "Nice", isCorrect: false },
  ],
  config: {},
};

describe("multiple choice: validateDefinition", () => {
  it("accepts 2–6 options with exactly one correct, trimming titles", () => {
    const result = validateDefinition("multiple_choice", {
      options: [
        { title: "  Yes ", isCorrect: true },
        { title: "No", isCorrect: false },
      ],
      config: { ignored: true },
    });
    expect(result).toEqual({
      options: [
        { title: "Yes", isCorrect: true },
        { title: "No", isCorrect: false },
      ],
      config: {},
    });
  });

  it.each([
    ["too few options", options(0, 1)],
    ["too many options", options(0, 7)],
    ["no correct option", options(-1)],
    [
      "two correct options",
      [
        { title: "a", isCorrect: true },
        { title: "b", isCorrect: true },
      ],
    ],
    [
      "an empty option",
      [
        { title: "a", isCorrect: true },
        { title: "  ", isCorrect: false },
      ],
    ],
  ])("rejects %s", (_label, opts) => {
    expect(() =>
      validateDefinition("multiple_choice", { options: opts, config: {} }),
    ).toThrow(QuestionDefinitionError);
  });

  it("rejects a type this build doesn't know", () => {
    expect(() =>
      validateDefinition("hotspot", { options: options(0), config: {} }),
    ).toThrow(/Unknown question type/);
  });
});

describe("multiple choice: play", () => {
  it("checks an answer against the option's flag", () => {
    expect(checkAnswer(live, { optionId: "a" })).toEqual({
      answer: { optionId: "a" },
      correct: true,
    });
    expect(checkAnswer(live, { optionId: "b" })?.correct).toBe(false);
  });

  it("refuses unknown options and malformed answers", () => {
    expect(checkAnswer(live, { optionId: "z" })).toBeNull();
    expect(checkAnswer(live, { optionId: "a", extra: 1 })).toBeNull();
    expect(checkAnswer(live, "a")).toBeNull();
  });

  it("scores with the standard decay", () => {
    const check = { answer: { optionId: "a" }, correct: true };
    expect(scoreAnswer(live, check, 0)).toBe(1000);
    expect(scoreAnswer(live, check, 10_000)).toBe(100);
    expect(scoreAnswer(live, { ...check, correct: false }, 0)).toBe(0);
  });

  it("strips the answer key from the public question", () => {
    const pub = toPublicQuestion(live);
    expect(pub).toEqual({
      type: "multiple_choice",
      id: "q",
      title: "Capital of France?",
      media: null,
      mediaType: null,
      timeOut: 10,
      options: [
        { id: "a", title: "Paris" },
        { id: "b", title: "Lyon" },
        { id: "c", title: "Nice" },
      ],
    });
  });

  it("summarises counts in option order with the correct ids", () => {
    expect(
      summarizeAnswers(live, [
        { optionId: "b" },
        { optionId: "a" },
        { optionId: "b" },
      ]),
    ).toEqual({
      type: "multiple_choice",
      counts: [1, 2, 0],
      correctOptionIds: ["a"],
    });
  });

  it("samples a right or a wrong option for bots", () => {
    expect(sampleAnswer(live, true, () => 0.99)).toEqual({ optionId: "a" });
    expect(sampleAnswer(live, false, () => 0.99)).toEqual({ optionId: "c" });
  });

  it("still answers when there is no wrong option to pick", () => {
    const allRight = {
      ...live,
      options: live.options.map((o) => ({ ...o, isCorrect: true })),
    };
    expect(sampleAnswer(allRight, false, () => 0)).toEqual({ optionId: "a" });
  });
});

describe("toLiveQuestion", () => {
  const row = {
    id: "q",
    type: "multiple_choice",
    title: "Capital of France?",
    media: null,
    mediaType: null,
    timeOut: 10,
    config: {},
    options: live.options,
  };

  it("loads a playable row", () => {
    expect(toLiveQuestion(row)).toEqual(live);
  });

  it("skips rows of unknown types or with content that no longer passes", () => {
    expect(toLiveQuestion({ ...row, type: "hotspot" })).toBeNull();
    expect(
      toLiveQuestion({ ...row, options: row.options.slice(0, 1) }),
    ).toBeNull();
  });
});

describe("normalizeLiveQuestion", () => {
  it("reads pre-type Redis snapshots as multiple choice", () => {
    const { type, config, ...legacy } = live;
    void type;
    void config;
    expect(normalizeLiveQuestion(legacy)).toEqual(live);
  });
});
