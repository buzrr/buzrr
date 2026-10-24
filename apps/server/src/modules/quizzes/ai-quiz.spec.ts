import { describe, expect, it } from "vitest";
import {
  applyReview,
  buildReviewPrompt,
  dedupe,
  isDuplicate,
  pickQuestions,
  toDefinitions,
  typedTimeOut,
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

describe("duplicates and time", () => {
  const mc = (question: string, correctAnswer: string) =>
    toDefinitions(title, {
      multipleChoice: [
        { question, correctAnswer, wrongAnswers: ["Alpha", "Beta", "Gamma"] },
      ],
      trueFalse: [],
      typeAnswer: [],
    })[0]!;

  it("spots the same fact asked twice", () => {
    const a = mc("Which river flows through Vienna?", "Danube");
    expect(
      isDuplicate(a, mc("Through which city flows the river?", "Danube")),
    ).toBe(true);
    expect(
      isDuplicate(
        mc("Which river flows through the city of Vienna?", "Danube"),
        mc("Which river flows through Vienna city centre?", "Donau"),
      ),
    ).toBe(true);
    expect(isDuplicate(a, mc("Which is the largest ocean?", "Pacific"))).toBe(
      false,
    );
  });

  it("keeps the first of each duplicate", () => {
    const a = mc("Which river flows through Vienna?", "Danube");
    const b = mc("Name the river of Budapest.", "Danube");
    const c = mc("Which is the largest ocean?", "Pacific");
    expect(dedupe([a, b, c])).toEqual([a, c]);
  });

  it("gives typed answers more time", () => {
    expect(typedTimeOut(20)).toBe(30);
    expect(typedTimeOut(10)).toBe(20);
    expect(typedTimeOut(500)).toBe(600);
  });
});

describe("variety", () => {
  const topic = "Bayerische Alpen: Berge und Bahnen in den Bayerischen Alpen";
  const out = (multipleChoice: [string, string][], trueFalse: string[] = []) =>
    toDefinitions("Bayerische Alpen", {
      multipleChoice: multipleChoice.map(([question, correctAnswer]) => ({
        question,
        correctAnswer,
        wrongAnswers: ["Wankbahn", "Jennerbahn", "Predigtstuhlbahn"]
          .filter((w) => w !== correctAnswer)
          .concat(["Laberbahn"])
          .slice(0, 3),
      })),
      trueFalse: trueFalse.map((statement) => ({ statement, isTrue: true })),
      typeAnswer: [],
    });

  it("drops an answer that is a question word's compound", () => {
    expect(
      out([
        [
          "Welche Bahn fährt von Garmisch-Partenkirchen auf den Gipfel der Zugspitze?",
          "Zugspitzbahn",
        ],
      ]),
    ).toHaveLength(0);
  });

  it("drops a question that names another question's answer", () => {
    const defs = out(
      [["Welcher Berg ist mit 2.962 Metern der höchste Punkt?", "Zugspitze"]],
      ["Die Zugspitze ist der höchste Berg Deutschlands."],
    );
    expect(defs).toHaveLength(2);
    expect(dedupe(defs, topic).map((d) => d.type)).toEqual(["multiple_choice"]);
  });

  it("keeps a subject to two questions, the topic's words aside", () => {
    const defs = out([
      ["Welche Bahn führt am Watzmann hinauf?", "Jennerbahn"],
      ["Wie heißt der See unter dem Watzmann?", "Königssee"],
      ["Welche Hütte liegt am Watzmann?", "Wankbahn"],
      [
        "Welche Bahn ist die älteste der Bayerischen Alpen?",
        "Predigtstuhlbahn",
      ],
    ]);
    const kept = dedupe(defs, topic).map((d) => d.title);
    expect(kept).toHaveLength(3);
    expect(kept).not.toContain("Welche Hütte liegt am Watzmann?");
  });
});
