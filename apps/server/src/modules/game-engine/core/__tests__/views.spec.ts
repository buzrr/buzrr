import { describe, expect, it } from "vitest";
import {
  averageAnswerMs,
  buildAnswerResult,
  buildLeaderboard,
  buildSnapshot,
  topOfLeaderboard,
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
      timeTakenMs: null,
    });
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
      rank: null,
      timeTakenMs: 1000,
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

describe("topOfLeaderboard", () => {
  const roster = Array.from({ length: 15 }, (_, i) => player(`p${i + 1}`));
  const scores = roster.map((p, i) => ({ playerId: p.id, score: 1500 - i }));
  const board = buildLeaderboard(scores, roster);

  it("keeps the top ten", () => {
    expect(topOfLeaderboard(board).map((e) => e.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("adds the player's own row below the top", () => {
    const rows = topOfLeaderboard(board, "p13");
    expect(rows).toHaveLength(11);
    expect(rows.at(-1)).toMatchObject({ playerId: "p13", rank: 13 });
  });

  it("adds nothing for a player already in the top", () => {
    expect(topOfLeaderboard(board, "p2")).toHaveLength(10);
  });

  it("sends players the top and the count in snapshots, the host everything", () => {
    const s = state({ meta: meta({ phase: "final" }), roster, scores });
    const forPlayer = buildSnapshot(s, "p13", T0);
    expect(forPlayer.leaderboard).toHaveLength(11);
    expect(forPlayer.leaderboardTotal).toBe(15);
    const forHost = buildSnapshot(s, null, T0);
    expect(forHost.leaderboard).toHaveLength(15);
    expect(forHost.leaderboardTotal).toBeUndefined();
  });
});
