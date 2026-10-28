import { describe, expect, it } from "vitest";
import {
  averageAnswerMs,
  buildAnswerResult,
  buildLeaderboard,
  buildSnapshot,
} from "../views";
import { T0, answer, meta, player, questionOpen, state } from "./fixtures";

describe("buildLeaderboard", () => {
  it("ranks scorers, then lists everyone else at zero, sharing a rank", () => {
    const entries = buildLeaderboard(
      [{ playerId: "p2", score: 800 }],
      [player("p1"), player("p2"), player("p3")],
    );
    expect(entries.map((e) => [e.playerId, e.score, e.rank])).toEqual([
      ["p2", 800, 1],
      ["p1", 0, 2],
      ["p3", 0, 2],
    ]);
    expect(entries[0]).not.toHaveProperty("delta");
  });

  it("gives equal scores one rank and the next score the next rank", () => {
    const entries = buildLeaderboard(
      [
        { playerId: "p1", score: 900 },
        { playerId: "p2", score: 500 },
        { playerId: "p3", score: 500 },
        { playerId: "p4", score: 200 },
      ],
      [player("p1"), player("p2"), player("p3"), player("p4"), player("p5")],
    );
    expect(entries.map((e) => e.rank)).toEqual([1, 2, 2, 3, 4]);
  });

  it("names a scorer who left the roster Unknown", () => {
    const [entry] = buildLeaderboard([{ playerId: "gone", score: 5 }], []);
    expect(entry?.name).toBe("Unknown");
  });
});

describe("buildAnswerResult", () => {
  it("ranks a player who hasn't scored with everyone else on zero", () => {
    expect(buildAnswerResult([], {}, "p1")).toEqual({
      answered: false,
      answer: null,
      isCorrect: false,
      score: 0,
      totalScore: 0,
      rank: 1,
    });
    const scores = [
      { playerId: "p2", score: 900 },
      { playerId: "p3", score: 900 },
      { playerId: "p4", score: 0 },
    ];
    expect(buildAnswerResult(scores, {}, "p1").rank).toBe(2);
    expect(buildAnswerResult(scores, {}, "p3").rank).toBe(1);
  });
});

describe("averageAnswerMs", () => {
  it("is null with nobody answering", () => {
    expect(averageAnswerMs({})).toBeNull();
  });
});

describe("buildSnapshot", () => {
  it("carries the time left on the start countdown", () => {
    const s = state({
      meta: meta({ phase: "starting", qDeadline: T0 + 3200 }),
    });
    expect(buildSnapshot(s, "p1", T0 + 1000)).toMatchObject({
      phase: "starting",
      remainingMs: 2200,
    });
    expect(buildSnapshot(s, "p1", T0 + 9999).remainingMs).toBe(0);
  });

  it("never carries the answer key while the question is open", () => {
    const s = questionOpen({ answers: { p2: answer("q1-b") } });
    const snapshot = buildSnapshot(s, "p1", T0 + 4000);
    expect(snapshot).toMatchObject({
      phase: "question",
      remainingMs: 6000,
      answeredCount: 1,
      you: { answered: false },
    });
    expect(snapshot.reveal).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain('isCorrect":true');
    expect(JSON.stringify(snapshot.question)).not.toContain("isCorrect");
  });

  it("tells a player their answer was stored, but not whether it was right", () => {
    const s = questionOpen({
      answers: { p1: answer("q1-a", { isCorrect: true, score: 900 }) },
      scores: [
        { playerId: "p1", score: 1500 },
        { playerId: "p2", score: 1000 },
      ],
    });
    expect(buildSnapshot(s, "p1", T0).you).toEqual({
      answered: true,
      answer: { optionId: "q1-a" },
      isCorrect: false,
      score: 0,
      totalScore: 600,
      // As of the last reveal: 600 behind p2's 1000.
      rank: 2,
    });
  });

  it("carries the time left to read during a question-first reading time", () => {
    const reading = questionOpen(
      {},
      { qStartAt: T0 + 5_000, qDeadline: T0 + 15_000, reactions: true },
    );
    const snap = buildSnapshot(reading, null, T0 + 2_000);
    expect(snap).toMatchObject({
      opensInMs: 3_000,
      remainingMs: 13_000,
      reactions: true,
    });
    expect(buildSnapshot(reading, null, T0 + 5_000).opensInMs).toBeUndefined();
  });

  it("falls back to the full window for an unstamped legacy question", () => {
    const s = questionOpen({}, { qStartAt: 0 });
    expect(buildSnapshot(s, null, T0).remainingMs).toBe(10_000);
  });

  it("includes the question, its reveal and the board during a reveal", () => {
    const s = questionOpen({
      answers: { p1: answer("q1-a", { isCorrect: true, score: 900 }) },
      scores: [{ playerId: "p1", score: 900 }],
    });
    const snapshot = buildSnapshot(
      { ...s, meta: { ...s.meta, phase: "reveal" } },
      "p1",
      T0,
    );
    expect(snapshot.question?.id).toBe("q1");
    expect(snapshot.reveal?.summary).toEqual({
      type: "multiple_choice",
      counts: [1, 0, 0, 0],
      responses: 1,
      correctOptionIds: ["q1-a"],
      correct: 1,
    });
    expect(snapshot.leaderboard?.[0]).toMatchObject({
      playerId: "p1",
      delta: 900,
    });
    expect(snapshot.you).toMatchObject({ answered: true, rank: 1 });
  });

  it("omits per-player data for the host", () => {
    const snapshot = buildSnapshot(state({ meta: meta() }), null, T0);
    expect(snapshot.you).toBeUndefined();
    expect(snapshot.players).toHaveLength(2);
  });
});
