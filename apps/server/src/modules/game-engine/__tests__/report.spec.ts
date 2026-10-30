import { describe, expect, it } from "vitest";
import { buildLeaderboard } from "../core";
import { T0, answer, player, question } from "../core/__tests__/fixtures";
import type { LiveQuestion, StoredAnswer } from "../game-engine.types";
import { buildSessionReport } from "../report";

const trueFalse: LiveQuestion = {
  id: "tf",
  type: "true_false",
  title: "The sky is blue",
  media: null,
  mediaType: null,
  timeOut: 10,
  options: [],
  config: { answer: true },
};

const words: LiveQuestion = {
  id: "wc",
  type: "word_cloud",
  title: "One word for today",
  media: null,
  mediaType: null,
  timeOut: 20,
  options: [],
  config: { maxAnswers: 1, maxLength: 20 } as LiveQuestion["config"],
};

function stored(
  value: StoredAnswer["answer"],
  opts: Partial<StoredAnswer> = {},
): StoredAnswer {
  return {
    answer: value,
    answeredAt: T0,
    timeTakenMs: 2000,
    isCorrect: false,
    score: 0,
    ...opts,
  };
}

function build() {
  const q1 = question("q1", { correct: 1 });
  const roster = [player("ana"), player("ben"), player("cy")];
  const answers: Record<string, StoredAnswer>[] = [
    {
      ana: answer("q1-b", { isCorrect: true, score: 900, timeTakenMs: 1500 }),
      ben: answer("q1-a", { timeTakenMs: 3000 }),
    },
    {
      ana: stored({ value: true }, { isCorrect: true, score: 800 }),
      ben: stored({ value: true }, { isCorrect: true, score: 800 }),
    },
    {
      ana: stored({ words: ["Sunny"] }),
      ben: stored({ words: ["sunny"] }),
      cy: stored({ words: ["Rain"] }),
    },
  ];
  const entries = buildLeaderboard(
    [
      { playerId: "ana", score: 1700 },
      { playerId: "ben", score: 800 },
    ],
    roster,
  );
  return buildSessionReport({
    quizTitle: "Mixed",
    gameCode: "ABC123",
    startedAt: T0,
    endedAt: null,
    questions: [q1, trueFalse, words],
    roster,
    entries,
    answers,
    now: T0 + 60_000,
  });
}

describe("buildSessionReport", () => {
  it("summarises the session over scored questions only", () => {
    const report = build();
    expect(report.playerCount).toBe(3);
    expect(report.questionCount).toBe(3);
    expect(report.scoredQuestionCount).toBe(2);
    // 3 correct of 2 scored questions × 3 players.
    expect(report.accuracy).toBeCloseTo(3 / 6);
    // 7 answers of 9 slots.
    expect(report.participation).toBeCloseTo(7 / 9);
    expect(report.endedAt).toBeNull();
  });

  it("tallies every option, marks the key and groups free text", () => {
    const [mc, tf, wc] = build().questions;
    expect(mc!.correct).toBe(1);
    expect(mc!.breakdown).toEqual([
      { label: "A", count: 1, isCorrect: false },
      { label: "B", count: 1, isCorrect: true },
      { label: "C", count: 0, isCorrect: false },
      { label: "D", count: 0, isCorrect: false },
    ]);
    expect(tf!.breakdown).toEqual([
      { label: "True", count: 2, isCorrect: true },
      { label: "False", count: 0, isCorrect: false },
    ]);
    expect(wc!.scored).toBe(false);
    expect(wc!.correct).toBeNull();
    expect(wc!.breakdown).toEqual([
      { label: "sunny", count: 2 },
      { label: "rain", count: 1 },
    ]);
  });

  it("gives each player their answers, including skipped questions", () => {
    const { players } = build();
    expect(players.map((p) => p.name)).toEqual(["ANA", "BEN", "CY"]);
    const [ana, , cy] = players;
    expect(ana!.correct).toBe(2);
    expect(ana!.accuracy).toBe(1);
    expect(ana!.fastestCorrectMs).toBe(1500);
    expect(ana!.answers[0]).toMatchObject({
      answer: "B",
      isCorrect: true,
      points: 900,
    });
    expect(cy!.answered).toBe(1);
    expect(cy!.accuracy).toBe(0);
    expect(cy!.answers[0]).toMatchObject({ answer: null, isCorrect: null });
    expect(cy!.answers[2]).toMatchObject({ answer: "Rain", isCorrect: null });
  });
});

describe("buildSessionReport — players off the board", () => {
  it("ignores answers from players no longer on the leaderboard", () => {
    const q1 = question("q1", { correct: 0 });
    const roster = [player("ana")];
    const report = buildSessionReport({
      quizTitle: "Left",
      gameCode: "ABC123",
      startedAt: T0,
      endedAt: null,
      questions: [q1],
      roster,
      entries: buildLeaderboard([{ playerId: "ana", score: 900 }], roster),
      answers: [
        {
          ana: answer("q1-a", { isCorrect: true, score: 900 }),
          // Kicked mid-game: the answer is still stored.
          zed: answer("q1-b"),
        },
      ],
    });
    expect(report.questions[0]!.answered).toBe(1);
    expect(report.questions[0]!.breakdown[1]!.count).toBe(0);
    expect(report.accuracy).toBe(1);
    expect(report.participation).toBe(1);
  });
});
