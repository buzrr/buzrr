import { describe, expect, it } from "vitest";
import {
  applyReview,
  buildReviewPrompt,
  pickQuestions,
  toDefinitions,
  type AiReviewOutput,
} from "./ai-quiz";

const title = "Geography";
const defs = toDefinitions(title, {
  multipleChoice: [
    {
      question: "Which river flows through Vienna?",
      correctAnswer: "Danube",
      wrongAnswers: ["Rhine", "Elbe", "Oder"],
    },
    {
      question: "Which is the largest ocean?",
      correctAnswer: "Pacific",
      wrongAnswers: ["Atlantic", "Indian", "Arctic"],
    },
  ],
  trueFalse: [{ statement: "Mount Everest is in Nepal.", isTrue: true }],
  typeAnswer: [],
});

const empty: AiReviewOutput = {
  multipleChoice: [],
  trueFalse: [],
  typeAnswer: [],
};

describe("AI review", () => {
  it("drops questions that give their answer away when written", () => {
    const leaky = toDefinitions(title, {
      multipleChoice: [
        {
          question: "The Danube flows through which city?",
          correctAnswer: "Danube",
          wrongAnswers: ["Rhine", "Elbe", "Oder"],
        },
      ],
      trueFalse: [],
      typeAnswer: [
        { question: "Capital of France?", answer: "Paris", alternatives: [] },
      ],
    });
    expect(leaky.map((d) => d.type)).toEqual(["type_answer"]);
  });

  it("sends every question with an id and its fields", () => {
    const prompt = buildReviewPrompt(
      {
        title,
        description: "Rivers and oceans",
        language: "English",
        time: 20,
        difficulty: 5,
      },
      defs,
    );
    expect(prompt).toContain('"id": "q1"');
    expect(prompt).toContain('"correctAnswer": "Danube"');
    expect(prompt).toContain('"statement": "Mount Everest is in Nepal."');
    expect(prompt).toContain("Hard: for experts");
  });

  it("keeps ok questions, takes clean rewrites and drops leaky ones", () => {
    const review: AiReviewOutput = {
      ...empty,
      multipleChoice: [
        {
          id: "q1",
          ok: true,
          problems: "",
          question: "x",
          correctAnswer: "x",
          wrongAnswers: ["a", "b", "c"],
        },
        {
          id: "q2",
          ok: false,
          problems: "Too easy",
          question: "Which ocean is the Pacific Ocean?",
          correctAnswer: "Pacific Ocean",
          wrongAnswers: ["Atlantic", "Indian", "Arctic"],
        },
      ],
      trueFalse: [
        {
          id: "q3",
          ok: false,
          problems: "Disputed",
          statement: "Mount Everest lies on the border of Nepal and China.",
          isTrue: true,
        },
      ],
    };
    const result = applyReview(title, defs, review);
    expect(result.revised).toEqual([false, true, true]);
    expect(result.defs[0]).toBe(defs[0]);
    expect(result.defs[1]).toBeNull();
    expect(result.defs[2]?.title).toBe(
      "Mount Everest lies on the border of Nepal and China.",
    );
  });

  it("drops a rewrite that changed the type", () => {
    const review: AiReviewOutput = {
      ...empty,
      trueFalse: [
        {
          id: "q1",
          ok: false,
          problems: "Better as a statement",
          statement: "The Danube flows through Vienna.",
          isTrue: true,
        },
      ],
    };
    expect(applyReview(title, defs, review).defs[0]).toBeNull();
  });

  it("picks the asked mix and fills a short type from the others", () => {
    const picked = pickQuestions(
      defs,
      { multipleChoice: 1, trueFalse: 2, typeAnswer: 0 },
      3,
    );
    expect(picked).toHaveLength(3);
    expect(picked.filter((d) => d.type === "true_false")).toHaveLength(1);
  });
});
