import { describe, expect, it } from "vitest";
import type { ModerationSettings } from "@buzrr/contract";
import { ANSWER_GRACE_MS } from "../../../../common/utils/answer-timing";
import { START_COUNTDOWN_MS, step } from "../machine";
import type { GameState } from "../state";
import { buildSnapshot } from "../views";
import {
  T0,
  answer,
  emitted,
  kinds,
  question,
  questionOpen,
  state,
} from "./fixtures";

const ALL_ON: ModerationSettings = {
  enabled: true,
  showAnswer: true,
  confirmShowAnswer: true,
  showScores: true,
  confirmShowScores: true,
  confirmNextQuestion: true,
};

const moderated = (mod: Partial<ModerationSettings> = {}) =>
  JSON.stringify({ ...ALL_ON, ...mod });

/** The phases a step announces with `phase-change`, in order. */
const phaseChanges = (
  s: GameState,
  event: Parameters<typeof step>[1],
  now = T0,
) =>
  emitted(step(s, event, now).effects)
    .filter((e) => e.event === "phase-change")
    .map((e) => (e.message as { payload: { phase: string } }).payload.phase);

const events = (s: GameState, event: Parameters<typeof step>[1], now = T0) =>
  emitted(step(s, event, now).effects).map((e) => e.event);

describe("moderated start", () => {
  const questions = [question("q1"), question("q2")];

  it("opens on question 1's get-ready slide and waits for the host", () => {
    const { state: next, effects } = step(
      state(),
      { type: "start", questions, quizTitle: "Q", moderation: ALL_ON },
      T0,
    );
    expect(next.meta).toMatchObject({
      phase: "ready",
      qIndex: 0,
      qDeadline: 0,
    });
    expect(kinds(effects)).toContain("park-deadline");
    expect(kinds(effects)).not.toContain("arm-timer");
    expect(emitted(effects).map((e) => e.event)).toEqual([
      "game-started",
      "phase-change",
    ]);
  });

  it("without the get-ready slide it counts down as usual", () => {
    const { state: next } = step(
      state(),
      {
        type: "start",
        questions,
        quizTitle: "Q",
        moderation: { ...ALL_ON, confirmNextQuestion: false },
      },
      T0,
    );
    expect(next.meta).toMatchObject({
      phase: "starting",
      qDeadline: T0 + START_COUNTDOWN_MS,
    });
  });

  it("ignores disabled moderation", () => {
    const { state: next } = step(
      state(),
      {
        type: "start",
        questions,
        quizTitle: "Q",
        moderation: { ...ALL_ON, enabled: false },
      },
      T0,
    );
    expect(next.meta.phase).toBe("starting");
    expect(next.meta.moderation).toBeUndefined();
  });
});

describe("moderated question flow", () => {
  const ready = (mod?: Partial<ModerationSettings>) =>
    state({
      meta: {
        ...state().meta,
        phase: "ready",
        qIndex: 1,
        qCount: 2,
        moderation: moderated(mod),
      },
    });

  it("host-next on the get-ready slide starts the countdown into that question", () => {
    const { state: next } = step(ready(), { type: "host-next" }, T0);
    expect(next.meta).toMatchObject({
      phase: "starting",
      qIndex: 1,
      qDeadline: T0 + START_COUNTDOWN_MS,
    });
    expect(phaseChanges(ready(), { type: "host-next" })).toEqual(["starting"]);
  });

  it("the countdown deadline opens the question it counted down to", () => {
    const counting = state({
      meta: {
        ...state().meta,
        phase: "starting",
        qIndex: 1,
        qCount: 2,
        qDeadline: T0,
        moderation: moderated(),
      },
    });
    const { state: next } = step(counting, { type: "deadline" }, T0);
    expect(next.meta).toMatchObject({
      phase: "question",
      qIndex: 1,
      qId: "q2",
    });
  });

  it("closing the question waits in 'closed' without revealing anything", () => {
    const open = questionOpen({}, { moderation: moderated() });
    const now = open.meta.qDeadline + ANSWER_GRACE_MS;
    const { state: next } = step(open, { type: "deadline" }, now);
    expect(next.meta.phase).toBe("closed");
    expect(events(open, { type: "deadline" }, now)).toEqual(["phase-change"]);
  });

  it("'show answer' reveals without the standings, 'show scores' sends them", () => {
    const closed = questionOpen(
      { answers: { p1: answer("q1-a", { isCorrect: true, score: 900 }) } },
      { phase: "closed", moderation: moderated() },
    );
    const revealEvents = events(closed, { type: "host-next" });
    expect(revealEvents).toContain("question-end");
    expect(revealEvents).toContain("answer-result");
    expect(revealEvents).not.toContain("leaderboard");

    const revealed = step(closed, { type: "host-next" }, T0).state;
    expect(revealed.meta.phase).toBe("reveal");
    const scored = step(revealed, { type: "host-next" }, T0);
    expect(scored.state.meta.phase).toBe("scores");
    expect(emitted(scored.effects).map((e) => e.event)).toEqual([
      "leaderboard",
      "phase-change",
    ]);
  });

  it("after the scores the next question gets its get-ready slide", () => {
    const scores = questionOpen(
      {},
      { phase: "scores", moderation: moderated() },
    );
    const { state: next } = step(scores, { type: "host-next" }, T0);
    expect(next.meta).toMatchObject({ phase: "ready", qIndex: 1 });
  });

  it("the last question's scores lead to the final leaderboard", () => {
    const last = questionOpen(
      {},
      { phase: "scores", moderation: moderated() },
      1,
    );
    const { state: next } = step(last, { type: "host-next" }, T0);
    expect(next.meta.phase).toBe("final");
  });

  it("without confirmations it behaves like an unmoderated reveal", () => {
    const mod = { confirmShowAnswer: false, confirmShowScores: false };
    const open = questionOpen({}, { moderation: moderated(mod) });
    const now = open.meta.qDeadline + ANSWER_GRACE_MS;
    expect(step(open, { type: "deadline" }, now).state.meta.phase).toBe(
      "reveal",
    );
    expect(events(open, { type: "deadline" }, now)).toContain("leaderboard");
  });

  it("with answers hidden, 'closed' goes straight to the scores", () => {
    const closed = questionOpen(
      {},
      { phase: "closed", moderation: moderated({ showAnswer: false }) },
    );
    const { state: next, effects } = step(closed, { type: "host-next" }, T0);
    expect(next.meta.phase).toBe("scores");
    // Players still get their personal result (it was never sent).
    expect(emitted(effects).map((e) => e.event)).toContain("answer-result");
    expect(emitted(effects).map((e) => e.event)).not.toContain("question-end");
  });

  it("host-paced steps park their deadline instead of advancing", () => {
    for (const phase of ["ready", "closed", "scores"] as const) {
      const s = questionOpen({}, { phase, moderation: moderated() });
      const { state: next, effects } = step(s, { type: "deadline" }, T0);
      expect(next.meta.phase).toBe(phase);
      expect(kinds(effects)).toEqual(["park-deadline"]);
    }
  });
});

describe("moderated snapshots", () => {
  it("'closed' shows the question but neither the answer nor the verdict", () => {
    const closed = questionOpen(
      { answers: { p1: answer("q1-a", { isCorrect: true, score: 900 }) } },
      { phase: "closed", moderation: moderated() },
    );
    const snap = buildSnapshot(closed, "p1", T0);
    expect(snap.question).toBeDefined();
    expect(snap.reveal).toBeUndefined();
    expect(snap.leaderboard).toBeUndefined();
    expect(snap.you).toMatchObject({ isCorrect: false, score: 0 });
    expect(snap.moderation).toMatchObject({ enabled: true });
  });

  it("a reveal followed by a scores step keeps the leaderboard back", () => {
    const reveal = questionOpen(
      {},
      { phase: "reveal", moderation: moderated() },
    );
    expect(buildSnapshot(reveal, null, T0).leaderboard).toBeUndefined();
    const scores = questionOpen(
      {},
      { phase: "scores", moderation: moderated() },
    );
    expect(buildSnapshot(scores, null, T0).leaderboard).toBeDefined();
  });
});
