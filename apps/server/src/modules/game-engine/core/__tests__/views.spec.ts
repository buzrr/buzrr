import { describe, expect, it } from "vitest";
import {
  averageAnswerMs,
  buildAnswerResult,
  buildLeaderboard,
  buildSnapshot,
} from "../views";
import { T0, answer, meta, player, questionOpen, state } from "./fixtures";

describe("buildLeaderboard", () => {
  it("ranks scorers, then lists everyone else at zero", () => {
    const entries = buildLeaderboard(
      [{ playerId: "p2", score: 800 }],
      [player("p1"), player("p2"), player("p3")],
    );
    expect(entries.map((e) => [e.playerId, e.score, e.rank])).toEqual([
      ["p2", 800, 1],
      ["p1", 0, 2],
      ["p3", 0, 3],
    ]);
    expect(entries[0]).not.toHaveProperty("delta");
  });

  it("names a scorer who left the roster Unknown", () => {
    const [entry] = buildLeaderboard([{ playerId: "gone", score: 5 }], []);
    expect(entry?.name).toBe("Unknown");
  });
});

describe("buildAnswerResult", () => {
  it("has no rank until the player has scored", () => {
    expect(buildAnswerResult([], {}, "p1")).toEqual({
      answered: false,
      answer: null,
      isCorrect: false,
      score: 0,
      totalScore: 0,
      rank: null,
    });
  });
});

describe("averageAnswerMs", () => {
  it("is null with nobody answering", () => {
    expect(averageAnswerMs({})).toBeNull();
  });
});

describe("buildSnapshot", () => {
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
      rank: null,
    });
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
      correctOptionIds: ["q1-a"],
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
