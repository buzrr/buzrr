import { describe, expect, it } from "vitest";
import type { QuestionAnswer } from "@buzrr/contract";
import { QuestionDefinitionError, type LiveQuestion } from "../question-type";
import {
  acceptsMoreAnswers,
  checkAnswer,
  isDuelEligible,
  mergeAnswers,
  isScored,
  sampleAnswer,
  scoreAnswer,
  summarizeAnswers,
  toPublicQuestion,
  validateDefinition,
} from "../registry";

const base = {
  id: "q",
  title: "Question?",
  media: null,
  mediaType: null,
  timeOut: 20,
};

const entries = (answers: QuestionAnswer[]) =>
  answers.map((answer) => ({ answer, author: null }));

describe("true / false", () => {
  const live: LiveQuestion = {
    ...base,
    type: "true_false",
    options: [
      { id: "t", title: "True", isCorrect: false },
      { id: "f", title: "False", isCorrect: true },
    ],
    config: {},
  };

  it("needs two options, exactly one correct", () => {
    const opts = [
      { title: "True", isCorrect: true },
      { title: "False", isCorrect: false },
    ];
    expect(
      validateDefinition("true_false", { options: opts, config: {} }).options,
    ).toEqual(opts);
    expect(() =>
      validateDefinition("true_false", {
        options: opts.map((o) => ({ ...o, isCorrect: true })),
        config: {},
      }),
    ).toThrow(QuestionDefinitionError);
    expect(() =>
      validateDefinition("true_false", { options: [opts[0]!], config: {} }),
    ).toThrow(QuestionDefinitionError);
  });

  it("is scored and duel-eligible", () => {
    expect(isScored("true_false")).toBe(true);
    const check = checkAnswer(live, { optionId: "f" });
    expect(check?.correct).toBe(true);
    expect(scoreAnswer(live, check!, 0)).toBe(1000);
    expect(checkAnswer(live, { optionId: "t" })?.correct).toBe(false);
    expect(
      isDuelEligible("true_false", {
        options: [
          { title: "True", isCorrect: true },
          { title: "False", isCorrect: false },
        ],
        config: {},
      }),
    ).toBe(true);
  });

  it("hides the answer key and summarises", () => {
    expect(toPublicQuestion(live)).not.toHaveProperty("options.0.isCorrect");
    expect(
      summarizeAnswers(live, entries([{ optionId: "f" }, { optionId: "t" }])),
    ).toEqual({
      type: "true_false",
      counts: [1, 1],
      responses: 2,
      correctOptionIds: ["f"],
      correct: 1,
    });
  });
});

describe("poll", () => {
  const live = (multiSelect: boolean): LiveQuestion => ({
    ...base,
    type: "poll",
    options: [
      { id: "a", title: "Goa", isCorrect: false },
      { id: "b", title: "Manali", isCorrect: false },
      { id: "c", title: "Pondicherry", isCorrect: false },
    ],
    config: { multiSelect },
  });

  it("takes 2–4 options and clears any correct flag", () => {
    const def = validateDefinition("poll", {
      options: [
        { title: "a", isCorrect: true },
        { title: "b", isCorrect: false },
      ],
      config: {},
    });
    expect(def.options.every((o) => !o.isCorrect)).toBe(true);
    expect(def.config).toEqual({ multiSelect: false });
    expect(() =>
      validateDefinition("poll", {
        options: Array.from({ length: 5 }, (_, i) => ({
          title: `${i}`,
          isCorrect: false,
        })),
        config: {},
      }),
    ).toThrow(QuestionDefinitionError);
  });

  it("allows several picks only when the poll does", () => {
    expect(checkAnswer(live(false), { optionIds: ["a", "b"] })).toBeNull();
    expect(checkAnswer(live(true), { optionIds: ["a", "b"] })).toEqual({
      answer: { optionIds: ["a", "b"] },
      correct: false,
    });
    expect(checkAnswer(live(false), { optionIds: ["z"] })).toBeNull();
  });

  it("scores nothing and stays out of duels", () => {
    const check = checkAnswer(live(false), { optionIds: ["a"] })!;
    expect(scoreAnswer(live(false), check, 0)).toBe(0);
    expect(isScored("poll")).toBe(false);
    expect(
      isDuelEligible("poll", {
        options: [
          { title: "a", isCorrect: false },
          { title: "b", isCorrect: false },
        ],
        config: {},
      }),
    ).toBe(false);
  });

  it("counts votes per option", () => {
    expect(
      summarizeAnswers(
        live(true),
        entries([{ optionIds: ["a", "b"] }, { optionIds: ["b"] }]),
      ),
    ).toEqual({ type: "poll", counts: [1, 2, 0], responses: 2 });
  });
});

describe("word cloud", () => {
  const live: LiveQuestion = {
    ...base,
    type: "word_cloud",
    options: [],
    config: { maxAnswers: 2, maxLength: 20, multipleSubmissions: false },
  };

  it("has no options and fills in config defaults", () => {
    expect(
      validateDefinition("word_cloud", { options: [], config: {} }),
    ).toEqual({
      options: [],
      config: { maxAnswers: 3, maxLength: 20, multipleSubmissions: false },
    });
    expect(() =>
      validateDefinition("word_cloud", {
        options: [{ title: "a", isCorrect: false }],
        config: {},
      }),
    ).toThrow(QuestionDefinitionError);
  });

  it("normalises, dedupes and enforces the limits", () => {
    expect(checkAnswer(live, { words: [" Great  Job", "great job"] })).toEqual({
      answer: { words: ["great job"] },
      correct: false,
    });
    expect(checkAnswer(live, { words: ["a", "b", "c"] })).toBeNull();
    expect(checkAnswer(live, { words: ["x".repeat(21)] })).toBeNull();
  });

  it("takes one word at a time, merged, when multiple submissions are on", () => {
    const multi: LiveQuestion = {
      ...live,
      config: { maxAnswers: 2, maxLength: 20, multipleSubmissions: true },
    };
    expect(acceptsMoreAnswers(live)).toBe(false);
    expect(acceptsMoreAnswers(multi)).toBe(true);
    expect(checkAnswer(multi, { words: ["a", "b"] })).toBeNull();
    expect(
      mergeAnswers(multi, { words: ["busy"] }, { words: ["fun"] }),
    ).toEqual({ words: ["busy", "fun"] });
    expect(
      mergeAnswers(multi, { words: ["busy"] }, { words: ["busy"] }),
    ).toEqual({ words: ["busy"] });
    const full = { words: Array.from({ length: 10 }, (_, i) => `w${i}`) };
    expect(mergeAnswers(multi, full, { words: ["more"] })).toBeNull();
    // Off: never merged, first answer wins.
    expect(mergeAnswers(live, { words: ["a"] }, { words: ["b"] })).toBeNull();
  });

  it("groups words by frequency", () => {
    expect(
      summarizeAnswers(
        live,
        entries([{ words: ["busy", "fun"] }, { words: ["Busy"] }]),
      ),
    ).toEqual({
      type: "word_cloud",
      words: [
        { word: "busy", count: 2 },
        { word: "fun", count: 1 },
      ],
      responses: 2,
    });
  });

  it("samples something for bots", () => {
    expect(
      checkAnswer(
        live,
        sampleAnswer(live, true, () => 0),
      ),
    ).not.toBeNull();
  });
});

describe("rating", () => {
  const live: LiveQuestion = {
    ...base,
    type: "rating",
    options: [],
    config: { scale: "5", lowLabel: "Low", highLabel: "High" },
  };

  it("keeps values on the scale", () => {
    expect(checkAnswer(live, { value: 5 })?.answer).toEqual({ value: 5 });
    expect(checkAnswer(live, { value: 6 })).toBeNull();
    expect(
      checkAnswer(
        {
          ...live,
          config: { scale: "10", lowLabel: "Low", highLabel: "High" },
        },
        { value: 10 },
      ),
    ).not.toBeNull();
  });

  it("counts each value", () => {
    expect(
      summarizeAnswers(
        live,
        entries([{ value: 1 }, { value: 5 }, { value: 5 }]),
      ),
    ).toEqual({ type: "rating", counts: [1, 0, 0, 0, 2], responses: 3 });
  });

  it("publishes the scale and labels", () => {
    expect(toPublicQuestion(live)).toMatchObject({
      scale: "5",
      lowLabel: "Low",
      highLabel: "High",
    });
  });
});

describe("open text", () => {
  const live = (allowAnonymous: boolean): LiveQuestion => ({
    ...base,
    type: "open_text",
    options: [],
    config: { maxLength: 100, allowAnonymous, multipleSubmissions: true },
  });

  it("enforces the length and the anonymity setting", () => {
    expect(
      checkAnswer(live(false), { text: " Hi ", anonymous: true })?.answer,
    ).toEqual({ entries: [{ text: "Hi", anonymous: false }] });
    expect(
      checkAnswer(live(true), { text: "Hi", anonymous: true })?.answer,
    ).toEqual({ entries: [{ text: "Hi", anonymous: true }] });
    // Players send one response; the stored list isn't a submission.
    expect(
      checkAnswer(live(true), { entries: [{ text: "Hi", anonymous: false }] }),
    ).toBeNull();
    expect(
      checkAnswer(live(true), { text: "x".repeat(101), anonymous: false }),
    ).toBeNull();
  });

  it("lists answers newest first, naming only those who allowed it", () => {
    const author = { name: "Maya", profilePic: "p.png" };
    expect(
      summarizeAnswers(live(true), [
        { answer: { entries: [{ text: "first", anonymous: false }] }, author },
        { answer: { entries: [{ text: "second", anonymous: true }] }, author },
      ]),
    ).toEqual({
      type: "open_text",
      entries: [
        { text: "second", name: null, profilePic: null },
        { text: "first", name: "Maya", profilePic: "p.png" },
      ],
      responses: 2,
    });
  });

  it("appends further responses up to the cap", () => {
    const one = { entries: [{ text: "a", anonymous: false }] };
    const merged = mergeAnswers(live(true), one, {
      entries: [{ text: "b", anonymous: true }],
    });
    expect(merged).toEqual({
      entries: [
        { text: "a", anonymous: false },
        { text: "b", anonymous: true },
      ],
    });
    const full = {
      entries: Array.from({ length: 10 }, (_, i) => ({
        text: `${i}`,
        anonymous: false,
      })),
    };
    expect(mergeAnswers(live(true), full, one)).toBeNull();
    // Every response is its own entry on the wall; responses counts players.
    expect(
      summarizeAnswers(live(true), [{ answer: merged!, author: null }]),
    ).toMatchObject({ entries: [{ text: "b" }, { text: "a" }], responses: 1 });
  });
});
