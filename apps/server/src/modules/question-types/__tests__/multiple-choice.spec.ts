import { describe, expect, it } from "vitest";
import { MAX_OPTIONS } from "@buzrr/contract";
import { QuestionDefinitionError } from "../question-type";
import {
  checkAnswer,
  isDuelEligible,
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
  it("accepts 2–6 options with one correct, trimming titles", () => {
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
      config: { multiSelect: false },
    });
  });

  it.each([
    ["too few options", options(0, 1)],
    ["too many options", options(0, MAX_OPTIONS + 1)],
    ["no correct option", options(-1)],
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

  it("takes several correct options only with multiple answers on", () => {
    const opts = [
      { title: "a", isCorrect: true },
      { title: "b", isCorrect: true },
    ];
    expect(
      validateDefinition("multiple_choice", {
        options: opts,
        config: { multiSelect: true },
      }),
    ).toEqual({ options: opts, config: { multiSelect: true } });
    expect(() =>
      validateDefinition("multiple_choice", {
        options: opts,
        config: { multiSelect: false },
      }),
    ).toThrow(/exactly one correct/);
  });

  it("reads an unset setting from the answer key (older rows, imports)", () => {
    const opts = [
      { title: "a", isCorrect: true },
      { title: "b", isCorrect: true },
    ];
    expect(
      validateDefinition("multiple_choice", { options: opts, config: {} })
        .config,
    ).toEqual({ multiSelect: true });
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
      multiSelect: false,
      audio: null,
    });
  });

  it("summarises counts in option order with the correct ids", () => {
    expect(
      summarizeAnswers(
        live,
        [{ optionId: "b" }, { optionId: "a" }, { optionId: "b" }].map(
          (answer) => ({ answer, author: null }),
        ),
      ),
    ).toEqual({
      type: "multiple_choice",
      counts: [1, 2, 0],
      responses: 3,
      correctOptionIds: ["a"],
      correct: 1,
    });
  });

  it("takes a one-option set for a single-answer question", () => {
    expect(checkAnswer(live, { optionIds: ["a"] })).toEqual({
      answer: { optionId: "a" },
      correct: true,
    });
    expect(checkAnswer(live, { optionIds: ["a", "b"] })).toBeNull();
  });

  it("samples a right or a wrong option for bots", () => {
    expect(sampleAnswer(live, true, () => 0.99)).toEqual({ optionId: "a" });
    expect(sampleAnswer(live, false, () => 0.99)).toEqual({ optionId: "c" });
  });

  it("still answers when there is no wrong option to pick", () => {
    const allRight = { ...live, options: live.options.slice(0, 1) };
    expect(sampleAnswer(allRight, false, () => 0)).toEqual({ optionId: "a" });
  });
});

describe("multiple choice: several correct options", () => {
  const multi: LiveQuestion = {
    ...live,
    options: [
      { id: "a", title: "Paris", isCorrect: true },
      { id: "b", title: "Lyon", isCorrect: true },
      { id: "c", title: "Nice", isCorrect: false },
    ],
  };

  it("tells players to pick a set", () => {
    expect(toPublicQuestion(multi)).toMatchObject({ multiSelect: true });
  });

  it("scores only the exact set", () => {
    expect(checkAnswer(multi, { optionIds: ["b", "a"] })?.correct).toBe(true);
    expect(checkAnswer(multi, { optionIds: ["a"] })?.correct).toBe(false);
    expect(checkAnswer(multi, { optionIds: ["a", "b", "c"] })?.correct).toBe(
      false,
    );
    expect(checkAnswer(multi, { optionId: "a" })).toEqual({
      answer: { optionIds: ["a"] },
      correct: false,
    });
    expect(checkAnswer(multi, { optionIds: ["a", "z"] })).toBeNull();
  });

  it("counts each ticked option and each exact set", () => {
    expect(
      summarizeAnswers(
        multi,
        [{ optionIds: ["a", "b"] }, { optionIds: ["a"] }].map((answer) => ({
          answer,
          author: null,
        })),
      ),
    ).toEqual({
      type: "multiple_choice",
      counts: [2, 1, 0],
      responses: 2,
      correctOptionIds: ["a", "b"],
      correct: 1,
    });
  });

  it("samples the right set, or a wrong one", () => {
    expect(sampleAnswer(multi, true)).toEqual({ optionIds: ["a", "b"] });
    const wrong = sampleAnswer(multi, false, () => 0);
    expect(checkAnswer(multi, wrong)?.correct).toBe(false);
  });

  it("is kept out of duels", () => {
    const def = (correct: boolean[], multiSelect?: boolean) => ({
      options: correct.map((isCorrect, i) => ({ title: `${i}`, isCorrect })),
      config: { multiSelect },
    });
    expect(isDuelEligible("multiple_choice", def([true, false]))).toBe(true);
    expect(isDuelEligible("multiple_choice", def([true, true]))).toBe(false);
    // On, even with one right option: players pick a set, duels tap.
    expect(isDuelEligible("multiple_choice", def([true, false], true))).toBe(
      false,
    );
  });

  it("asks for a set when on, even with one right option", () => {
    const oneRight: LiveQuestion = { ...live, config: { multiSelect: true } };
    expect(toPublicQuestion(oneRight)).toMatchObject({ multiSelect: true });
    expect(checkAnswer(oneRight, { optionIds: ["a"] })).toEqual({
      answer: { optionIds: ["a"] },
      correct: true,
    });
    expect(checkAnswer(oneRight, { optionIds: ["a", "b"] })?.correct).toBe(
      false,
    );
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

  it("carries the question's sound and its cues", () => {
    const withAudio = {
      ...row,
      audio: "https://x/a.mp3",
      audioStartMs: 1500,
      audioRevealMs: null,
    };
    const q = toLiveQuestion(withAudio)!;
    expect(q.audio).toEqual({
      url: "https://x/a.mp3",
      startMs: 1500,
      revealMs: null,
      playOn: "quiz",
    });
    expect(toPublicQuestion(q).audio).toEqual(q.audio);
  });

  it("loads a playable row, settling its settings", () => {
    expect(toLiveQuestion(row)).toEqual({
      ...live,
      config: { multiSelect: false },
      audio: null,
    });
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
