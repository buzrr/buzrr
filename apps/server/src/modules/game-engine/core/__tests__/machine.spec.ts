import { describe, expect, it } from "vitest";
import { ANSWER_GRACE_MS } from "../../../../common/utils/answer-timing";
import { START_COUNTDOWN_MS, step } from "../machine";
import { AUTO_REVEAL_MS, pacingFor } from "../pacing";
import type { Effect } from "../state";
import {
  T0,
  answer,
  duelMeta,
  emitted,
  fixedRandom,
  kinds,
  meta,
  player,
  question,
  questionOpen,
  state,
} from "./fixtures";

const effectOf = <K extends Effect["kind"]>(effects: Effect[], kind: K) =>
  effects.find((e): e is Extract<Effect, { kind: K }> => e.kind === kind);

describe("start", () => {
  const questions = [question("q1"), question("q2")];

  it("writes the questions and the countdown, then announces and arms", () => {
    const { state: next, effects } = step(
      state(),
      { type: "start", questions, quizTitle: "Capitals" },
      T0,
    );
    expect(kinds(effects)).toEqual([
      "set-questions",
      "patch-meta",
      "set-deadline",
      "claim-owner",
      "mark-playing",
      "emit",
      "arm-timer",
    ]);
    expect(next.meta).toMatchObject({
      phase: "starting",
      quizTitle: "Capitals",
      qCount: 2,
      startedAt: T0,
      qDeadline: T0 + START_COUNTDOWN_MS,
    });
    expect(effectOf(effects, "set-deadline")?.at).toBe(T0 + START_COUNTDOWN_MS);
    expect(emitted(effects).map((e) => e.event)).toEqual(["game-started"]);
  });

  it("only starts a lobby", () => {
    const s = state({ meta: meta({ phase: "question" }) });
    expect(
      step(s, { type: "start", questions, quizTitle: "x" }, T0).effects,
    ).toEqual([]);
  });

  it("refuses a quiz with nothing playable", () => {
    const { effects } = step(
      state(),
      { type: "start", questions: [], quizTitle: "x" },
      T0,
    );
    expect(kinds(effects)).toEqual(["log"]);
  });
});

describe("opening a question (deadline in starting)", () => {
  const starting = state({ meta: meta({ phase: "starting", qCount: 2 }) });

  it("makes the window durable before it is broadcast", () => {
    const { effects } = step(starting, { type: "deadline" }, T0);
    // Schedule entry → phase + window → broadcast → local timer.
    expect(kinds(effects)).toEqual([
      "set-deadline",
      "patch-meta",
      "emit",
      "arm-timer",
    ]);
    const closeAt = T0 + 10_000 + ANSWER_GRACE_MS;
    expect(effectOf(effects, "set-deadline")?.at).toBe(closeAt);
    expect(effectOf(effects, "arm-timer")?.at).toBe(closeAt);
    expect(effectOf(effects, "patch-meta")?.patch).toMatchObject({
      phase: "question",
      qIndex: 0,
      qId: "q1",
      qStartAt: T0,
      // The real window — the grace is only on the schedule entry.
      qDeadline: T0 + 10_000,
    });
  });

  it("sends the question without its answer key", () => {
    const { effects } = step(starting, { type: "deadline" }, T0);
    const [start] = emitted(effects);
    expect(start?.event).toBe("question-start");
    if (start?.message.event !== "question-start") throw new Error();
    expect(start.message.deadline).toBe(T0 + 10_000);
    expect(start.message.payload).toMatchObject({
      index: 0,
      qCount: 2,
      remainingMs: 10_000,
    });
    expect(JSON.stringify(start.message.payload)).not.toContain("isCorrect");
  });

  it("plans and arms a duel bot's answer in the same write", () => {
    const duel = state({
      meta: duelMeta({
        phase: "starting",
        qCount: 2,
        botId: "bot_x",
        botTier: "easy",
      }),
    });
    // random() = 0: under every tier's accuracy (so correct), shortest delay.
    const { effects } = step(duel, { type: "deadline" }, T0, {
      random: fixedRandom(0),
    });
    const patch = effectOf(effects, "patch-meta")?.patch;
    const bot = effectOf(effects, "arm-bot");
    expect(bot).toMatchObject({
      botId: "bot_x",
      qIndex: 0,
      answer: { optionId: "q1-a" },
    });
    expect(patch?.botAnswer).toBe(JSON.stringify({ optionId: "q1-a" }));
    expect(patch?.botAnswerAt).toBe(bot?.at);
    // easy bots wait at least 55% of the window
    expect(bot!.at - T0).toBe(5_500);
    expect(kinds(effects).at(-1)).toBe("arm-bot");
  });

  it("logs rather than opening a question that isn't there", () => {
    const s = state({ meta: meta({ phase: "starting" }), questions: [] });
    expect(kinds(step(s, { type: "deadline" }, T0).effects)).toEqual(["log"]);
  });
});

describe("deadline during a question", () => {
  it("waits out the grace", () => {
    const s = questionOpen();
    const at = s.meta.qDeadline + ANSWER_GRACE_MS - 1;
    expect(step(s, { type: "deadline" }, at).effects).toEqual([]);
  });

  it("reveals once the grace has run out", () => {
    const s = questionOpen();
    const at = s.meta.qDeadline + ANSWER_GRACE_MS;
    const { state: next } = step(s, { type: "deadline" }, at);
    expect(next.meta.phase).toBe("reveal");
  });

  it("re-opens a legacy question whose window was never stamped", () => {
    const s = questionOpen({}, { qStartAt: 0 });
    const { effects } = step(s, { type: "deadline" }, T0);
    expect(effectOf(effects, "patch-meta")?.patch.qStartAt).toBe(T0);
  });

  it("does nothing while the duel is paused", () => {
    const s = questionOpen({ meta: duelMeta() }, { pausedAt: T0 });
    expect(step(s, { type: "deadline" }, T0 + 60_000).effects).toEqual([]);
  });
});

describe("reveal", () => {
  const answered = questionOpen({
    answers: {
      p1: answer("q1-a", { isCorrect: true, score: 900, timeTakenMs: 1000 }),
      p2: answer("q1-b", { timeTakenMs: 3000 }),
    },
    scores: [
      { playerId: "p1", score: 1700 },
      { playerId: "p2", score: 400 },
    ],
  });

  it("tells each player their result before the room flips to the reveal", () => {
    const { effects } = step(answered, { type: "host-next" }, T0 + 4000);
    expect(kinds(effects).slice(0, 4)).toEqual([
      "clear-timer",
      "cancel-bot",
      "patch-meta",
      "park-deadline",
    ]);
    expect(emitted(effects).map((e) => e.event)).toEqual([
      "answer-result",
      "answer-result",
      "question-end",
      "leaderboard",
    ]);
  });

  it("builds the personal results from the stored answers and scores", () => {
    const { effects } = step(answered, { type: "host-next" }, T0 + 4000);
    const [p1, p2] = emitted(effects);
    expect(p1?.to).toEqual({ player: "p1" });
    expect(p1?.message).toMatchObject({
      payload: {
        answered: true,
        answer: { optionId: "q1-a" },
        isCorrect: true,
        score: 900,
        totalScore: 1700,
        rank: 1,
      },
    });
    expect(p2?.message).toMatchObject({
      payload: { answered: true, isCorrect: false, score: 0, rank: 2 },
    });
  });

  it("summarises through the question's type", () => {
    const { effects } = step(answered, { type: "host-next" }, T0 + 4000);
    const end = emitted(effects).find((e) => e.event === "question-end");
    expect(end?.message).toMatchObject({
      payload: {
        index: 0,
        avgTimeMs: 2000,
        summary: {
          type: "multiple_choice",
          counts: [1, 1, 0, 0],
          correctOptionIds: ["q1-a"],
        },
      },
    });
  });

  it("carries each player's points for the question on the leaderboard", () => {
    const { effects } = step(answered, { type: "host-next" }, T0 + 4000);
    const board = emitted(effects).find((e) => e.event === "leaderboard");
    expect(board?.message).toMatchObject({
      payload: {
        isFinal: false,
        entries: [
          { playerId: "p1", delta: 900, rank: 1 },
          { playerId: "p2", delta: 0, rank: 2 },
        ],
      },
    });
  });

  it("schedules its own end when the game auto-advances", () => {
    const duel = questionOpen({ meta: duelMeta() });
    const now = duel.meta.qDeadline + ANSWER_GRACE_MS;
    const { state: next, effects } = step(duel, { type: "deadline" }, now);
    expect(next.meta.qDeadline).toBe(now + AUTO_REVEAL_MS);
    expect(effectOf(effects, "set-deadline")?.at).toBe(now + AUTO_REVEAL_MS);
    expect(effectOf(effects, "arm-timer")?.at).toBe(now + AUTO_REVEAL_MS);
    expect(kinds(effects)).not.toContain("park-deadline");
  });
});

describe("out of the reveal", () => {
  const revealing = (overrides = {}, metaOverrides = {}, qIndex = 0) => {
    const s = questionOpen(overrides, metaOverrides, qIndex);
    return { ...s, meta: { ...s.meta, phase: "reveal" as const } };
  };

  it("the host moves on to the next question", () => {
    const { state: next } = step(revealing(), { type: "host-next" }, T0);
    expect(next.meta).toMatchObject({ phase: "question", qIndex: 1 });
    expect(next.answers).toEqual({});
  });

  it("the host reaches the final leaderboard after the last question", () => {
    const s = revealing({}, {}, 1);
    const { state: next, effects } = step(s, { type: "host-next" }, T0);
    expect(next.meta.phase).toBe("final");
    expect(kinds(effects)).toEqual([
      "clear-timer",
      "park-deadline",
      "patch-meta",
      "emit",
    ]);
    expect(emitted(effects)[0]?.message).toMatchObject({
      payload: { isFinal: true },
    });
  });

  it("a host-paced reveal that comes due is parked again, not advanced", () => {
    const { state: next, effects } = step(
      revealing(),
      { type: "deadline" },
      T0,
    );
    expect(next.meta.phase).toBe("reveal");
    expect(kinds(effects)).toEqual(["park-deadline"]);
  });

  it("an auto-paced reveal advances on its deadline", () => {
    const s = revealing({ meta: duelMeta() });
    expect(step(s, { type: "deadline" }, T0).state.meta.qIndex).toBe(1);
  });

  it("an auto-paced game ends at the final leaderboard", () => {
    const s = revealing({ meta: duelMeta() }, {}, 1);
    const { effects } = step(s, { type: "deadline" }, T0);
    expect(kinds(effects).at(-1)).toBe("end-game");
  });
});

describe("host-next", () => {
  it("ends the game from the final leaderboard", () => {
    const s = state({ meta: meta({ phase: "final" }) });
    expect(kinds(step(s, { type: "host-next" }, T0).effects)).toEqual([
      "end-game",
    ]);
  });

  it("does nothing in the lobby", () => {
    expect(step(state(), { type: "host-next" }, T0).effects).toEqual([]);
  });

  it("can't drive a game nobody hosts", () => {
    const s = questionOpen({ meta: duelMeta() });
    expect(step(s, { type: "host-next" }, T0).effects).toEqual([]);
  });
});

describe("answer-recorded", () => {
  it("updates the host's meter while players are still thinking", () => {
    const s = questionOpen({ answers: { p1: answer("q1-a") } });
    const { effects } = step(s, { type: "answer-recorded", qIndex: 0 }, T0);
    expect(kinds(effects)).toEqual(["emit"]);
    expect(emitted(effects)[0]?.message).toMatchObject({
      event: "answer-count",
      payload: { index: 0, answered: 1 },
    });
  });

  it("closes the question once every connected player has answered", () => {
    const s = questionOpen({
      roster: [player("p1"), player("p2", { connected: false })],
      answers: { p1: answer("q1-a") },
    });
    const { effects } = step(s, { type: "answer-recorded", qIndex: 0 }, T0);
    expect(effects.at(-1)).toEqual({
      kind: "dispatch",
      event: "close-question",
    });
  });

  it("ignores an answer to a question that has already moved on", () => {
    const s = questionOpen({ answers: { p1: answer("q2-a") } }, {}, 1);
    expect(step(s, { type: "answer-recorded", qIndex: 0 }, T0).effects).toEqual(
      [],
    );
  });

  it("does nothing once the question has closed", () => {
    const s = questionOpen();
    const revealed = { ...s, meta: { ...s.meta, phase: "reveal" as const } };
    expect(
      step(revealed, { type: "answer-recorded", qIndex: 0 }, T0).effects,
    ).toEqual([]);
  });

  it("does not close a question with nobody connected", () => {
    const s = questionOpen({
      roster: [player("p1", { connected: false })],
    });
    expect(step(s, { type: "answer-recorded", qIndex: 0 }, T0).effects).toEqual(
      [],
    );
  });
});

describe("roster-changed", () => {
  it("can close the question when the last holdout leaves", () => {
    const s = questionOpen({
      roster: [player("p1")],
      answers: { p1: answer("q1-a") },
    });
    expect(kinds(step(s, { type: "roster-changed" }, T0).effects)).toEqual([
      "emit",
      "dispatch",
    ]);
  });

  it("re-sends the reveal leaderboard without the removed player", () => {
    const s = questionOpen({
      roster: [player("p1")],
      scores: [{ playerId: "p1", score: 500 }],
      answers: { p1: answer("q1-a", { score: 500 }) },
    });
    const revealed = { ...s, meta: { ...s.meta, phase: "reveal" as const } };
    const { effects } = step(revealed, { type: "roster-changed" }, T0);
    expect(emitted(effects)[0]?.message).toMatchObject({
      event: "leaderboard",
      payload: {
        isFinal: false,
        entries: [{ playerId: "p1", delta: 500 }],
      },
    });
  });

  it("re-sends the final leaderboard", () => {
    const s = state({ meta: meta({ phase: "final" }) });
    const { effects } = step(s, { type: "roster-changed" }, T0);
    expect(emitted(effects)[0]?.message).toMatchObject({
      payload: { isFinal: true },
    });
  });
});

describe("ended games", () => {
  it("drop a stale schedule entry and nothing else", () => {
    const s = state({ meta: meta({ phase: "ended" }) });
    expect(kinds(step(s, { type: "deadline" }, T0).effects)).toEqual([
      "clear-deadline",
    ]);
    expect(step(s, { type: "host-next" }, T0).effects).toEqual([]);
  });
});

describe("pacingFor", () => {
  it("falls back to what the mode implied for games without a stored pacing", () => {
    expect(pacingFor({ mode: "duel" }).mode).toBe("auto");
    expect(pacingFor({ mode: "classic" }).mode).toBe("host");
  });

  it("prefers the stored pacing", () => {
    expect(pacingFor({ mode: "classic", pacing: "auto" }).mode).toBe("auto");
  });
});
