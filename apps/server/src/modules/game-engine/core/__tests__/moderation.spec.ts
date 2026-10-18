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
    // The room only learns the step; the tally goes to the host alone.
    const out = emitted(step(open, { type: "deadline" }, now).effects);
    expect(out.map((e) => e.event)).toEqual(["phase-change", "closed-summary"]);
    expect(out.find((e) => e.event === "closed-summary")?.to).toEqual({
      host: true,
    });
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

  it("after the scores the next question counts down (get-ready only opens the round)", () => {
    const scores = questionOpen(
      {},
      { phase: "scores", moderation: moderated() },
    );
    const { state: next } = step(scores, { type: "host-next" }, T0);
    expect(next.meta).toMatchObject({ phase: "starting", qIndex: 1 });
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

  it("the last question's 'closed' step sends every player their result before any standings", () => {
    const closed = questionOpen(
      {},
      { phase: "closed", moderation: moderated() },
      1,
    );
    const { state: next, effects } = step(closed, { type: "host-next" }, T0);
    expect(next.meta.phase).toBe("reveal");
    expect(emitted(effects).map((e) => e.event)).toContain("answer-result");
  });

  it("an older quiz that hid the answer still reveals it", () => {
    const closed = questionOpen(
      {},
      {
        phase: "closed",
        moderation: JSON.stringify({
          ...JSON.parse(moderated()),
          showAnswer: false,
        }),
      },
    );
    const { state: next } = step(closed, { type: "host-next" }, T0);
    expect(next.meta.phase).toBe("reveal");
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

describe("sound clips", () => {
  const withClip = (id: string) => ({
    ...question(id),
    audio: {
      url: `https://x/${id}.mp3`,
      startMs: 0,
      revealMs: 0,
      playOn: "quiz" as const,
      clipUrl: `https://x/${id}.bin`,
      clipKey: `${id}-qkey`,
      revealClipUrl: `https://x/${id}-r.bin`,
      revealKey: `${id}-rkey`,
    },
  });

  it("the reveal preloads the next question's clips — without any key", () => {
    const open = questionOpen({ questions: [question("q1"), withClip("q2")] });
    const now = open.meta.qDeadline + ANSWER_GRACE_MS;
    const { effects } = step(open, { type: "deadline" }, now);
    const pre = emitted(effects).find((e) => e.event === "preload");
    expect(pre?.message).toMatchObject({
      payload: { qIndex: 1, urls: ["https://x/q2.bin", "https://x/q2-r.bin"] },
    });
    expect(JSON.stringify(pre)).not.toContain("key");
  });

  it("the reveal key comes with the reveal, not with the question", () => {
    const open = questionOpen({ questions: [withClip("q1"), question("q2")] });
    const now = open.meta.qDeadline + ANSWER_GRACE_MS;
    const end = emitted(step(open, { type: "deadline" }, now).effects).find(
      (e) => e.event === "question-end",
    );
    expect(end?.message).toMatchObject({
      payload: { audioRevealKey: "q1-rkey" },
    });
    const snap = buildSnapshot(open, "p1", T0);
    expect(JSON.stringify(snap)).not.toContain("q1-rkey");
    expect(snap.question?.audio).toMatchObject({ key: "q1-qkey" });
  });
});

describe("the countdown waits for sound downloads", () => {
  const withClip = {
    ...question("q2"),
    audio: {
      url: "https://x/q2.mp3",
      startMs: 0,
      revealMs: null,
      playOn: "quiz" as const,
      clipUrl: "https://x/q2.bin",
      clipKey: "k",
    },
  };
  const counting = (preloads: GameState["preloads"], since = 0) =>
    state({
      questions: [question("q1"), withClip],
      preloads,
      meta: {
        ...state().meta,
        phase: "starting",
        qIndex: 1,
        qCount: 2,
        qDeadline: T0,
        preloadWaitSince: since,
      },
    });
  const loading = (at: number) => ({ loaded: 10, total: 100, done: false, at });

  it("keeps counting while a connected device is still downloading", () => {
    const { state: next, effects } = step(
      counting({ p1: loading(T0 - 500) }),
      { type: "deadline" },
      T0,
    );
    expect(next.meta.phase).toBe("starting");
    expect(next.meta.preloadWaitSince).toBe(T0);
    const pc = emitted(effects).find((e) => e.event === "phase-change");
    expect(pc?.message).toMatchObject({ payload: { waitingFor: 1 } });
  });

  it("opens once everyone is done", () => {
    const done = { loaded: 100, total: 100, done: true, at: T0 };
    expect(
      step(counting({ p1: done, p2: done }), { type: "deadline" }, T0).state
        .meta.phase,
    ).toBe("question");
  });

  it("ignores a download that stopped moving, and a player who left", () => {
    const stalled = counting({ p1: loading(T0 - 5_000) });
    expect(step(stalled, { type: "deadline" }, T0).state.meta.phase).toBe(
      "question",
    );
    const gone = counting({ ghost: loading(T0) });
    expect(step(gone, { type: "deadline" }, T0).state.meta.phase).toBe(
      "question",
    );
  });

  it("never waits longer than the cap", () => {
    const long = counting({ p1: loading(T0) }, T0 - 31_000);
    expect(step(long, { type: "deadline" }, T0).state.meta.phase).toBe(
      "question",
    );
  });

  it("reports how many devices are done", () => {
    const done = { loaded: 100, total: 100, done: true, at: T0 };
    const { effects } = step(
      counting({ p1: loading(T0), p2: done }),
      { type: "deadline" },
      T0,
    );
    const pc = emitted(effects).find((e) => e.event === "phase-change");
    expect(pc?.message).toMatchObject({
      payload: { waitingFor: 1, downloadDevices: 2, downloadsDone: 1 },
    });
  });

  it("the host can go on now, or lift the time limit", () => {
    const waiting = counting({ p1: loading(T0) }, T0 - 1_000);
    expect(
      step(waiting, { type: "downloads-decision", wait: false }, T0).state.meta
        .phase,
    ).toBe("question");
    const all = step(
      waiting,
      { type: "downloads-decision", wait: true },
      T0,
    ).state;
    expect(all.meta.preloadWaitAll).toBe(1);
    // Past the 30 s cap, still waiting for the device that is downloading.
    const later = { ...all, preloads: { p1: loading(T0 + 40_000) } };
    const { state: next, effects } = step(
      later,
      { type: "deadline" },
      T0 + 40_000,
    );
    expect(next.meta.phase).toBe("starting");
    const pc = emitted(effects).find((e) => e.event === "phase-change");
    expect(pc?.message).toMatchObject({ payload: { waitAll: true } });
  });

  it("ignores a decision when nothing is waiting", () => {
    const fresh = counting({ p1: loading(T0) });
    const { state: next } = step(
      fresh,
      { type: "downloads-decision", wait: false },
      T0,
    );
    expect(next.meta.phase).toBe("starting");
  });

  it("a question without sound doesn't wait at all", () => {
    const plain = state({
      preloads: { p1: loading(T0) },
      meta: {
        ...state().meta,
        phase: "starting",
        qIndex: 1,
        qCount: 2,
        qDeadline: T0,
      },
    });
    expect(step(plain, { type: "deadline" }, T0).state.meta.phase).toBe(
      "question",
    );
  });
});

describe("the countdown before a question", () => {
  it("doesn't reveal the coming question", () => {
    const counting = state({
      meta: {
        ...state().meta,
        phase: "starting",
        qIndex: 1,
        qDeadline: T0 + 3000,
      },
    });
    const snap = buildSnapshot(counting, null, T0);
    expect(snap.question).toBeUndefined();
    expect(JSON.stringify(snap)).not.toContain("Question q2");
  });
});

describe("playing without players", () => {
  it("host-next skips the countdown into the question", () => {
    const counting = state({
      roster: [],
      meta: {
        ...state().meta,
        phase: "starting",
        qIndex: 0,
        qCount: 2,
        qDeadline: T0 + 4000,
      },
    });
    const { state: next } = step(counting, { type: "host-next" }, T0);
    expect(next.meta).toMatchObject({ phase: "question", qIndex: 0 });
  });
});
