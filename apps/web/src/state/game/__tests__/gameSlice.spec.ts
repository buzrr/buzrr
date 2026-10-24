import { describe, expect, it } from "vitest";
import type {
  PublicQuestion,
  QuestionEndPayload,
  StateSyncPayload,
} from "@buzrr/contract";
import reducer, {
  answerResult,
  applySync,
  gameOver,
  gameProgress,
  reactionBudgetKnown,
  liveSummary,
  questionEnd,
  questionStart,
  resetGame,
  type GameLiveState,
} from "../gameSlice";

const question = (id: string): PublicQuestion => ({
  id,
  type: "multiple_choice",
  title: `Question ${id}`,
  media: null,
  mediaType: null,
  timeOut: 10,
  options: [
    { id: `${id}-a`, title: "A" },
    { id: `${id}-b`, title: "B" },
  ],
  multiSelect: false,
});

const reveal = (index: number): QuestionEndPayload => ({
  index,
  summary: {
    type: "multiple_choice",
    counts: [1, 0],
    responses: 1,
    correctOptionIds: [],
    correct: 0,
  },
  avgTimeMs: null,
});

const sync = (overrides: Partial<StateSyncPayload>): StateSyncPayload => ({
  phase: "lobby",
  mode: "classic",
  qIndex: 0,
  qCount: 3,
  players: [],
  ...overrides,
});

const fresh = (): GameLiveState => reducer(undefined, resetGame());

/** Question `index` open, as a client sees it after `question-start`. */
const onQuestion = (index: number, from = fresh()) =>
  reducer(
    from,
    questionStart({
      index,
      qCount: 3,
      question: question(`q${index}`),
      remainingMs: 10_000,
    }),
  );

describe("gameProgress", () => {
  it("orders every phase of a game", () => {
    const moments = [
      gameProgress("lobby", 0),
      gameProgress("starting", 0),
      gameProgress("question", 0),
      gameProgress("reveal", 0),
      gameProgress("question", 1),
      gameProgress("reveal", 1),
      gameProgress("question", 49),
      gameProgress("reveal", 49),
      gameProgress("final", 49),
      gameProgress("ended", 49),
    ];
    expect([...moments].sort((a, b) => a - b)).toEqual(moments);
    expect(new Set(moments).size).toBe(moments.length);
  });
});

describe("applySync", () => {
  it("drops a reveal snapshot that arrives after the next question started", () => {
    // The reported bug: the snapshot was read while question 0 was being
    // revealed, but sent after `question-start` for question 1.
    const revealed = reducer(onQuestion(0), questionEnd(reveal(0)));
    const next = onQuestion(1, revealed);

    const after = reducer(
      next,
      applySync(
        sync({
          phase: "reveal",
          qIndex: 0,
          reveal: reveal(0),
          question: question("q0"),
        }),
      ),
    );

    expect(after).toEqual(next);
    expect(after.phase).toBe("question");
    expect(after.question?.id).toBe("q1");
  });

  it("drops a question snapshot that arrives after the reveal", () => {
    const revealed = reducer(onQuestion(2), questionEnd(reveal(2)));

    const after = reducer(
      revealed,
      applySync(sync({ phase: "question", qIndex: 2, remainingMs: 4_000 })),
    );

    expect(after.phase).toBe("reveal");
  });

  it("drops a final-leaderboard snapshot that arrives after game over", () => {
    const over = reducer(
      onQuestion(2),
      gameOver({ entries: [], rated: false }),
    );

    const after = reducer(over, applySync(sync({ phase: "final", qIndex: 2 })));

    expect(after.phase).toBe("ended");
  });

  it("applies a snapshot for the same moment, which may carry newer details", () => {
    const open = onQuestion(1);

    const after = reducer(
      open,
      applySync(
        sync({
          phase: "question",
          qIndex: 1,
          question: question("q1"),
          remainingMs: 3_000,
          answeredCount: 2,
        }),
      ),
    );

    expect(after.answeredCount).toBe(2);
  });

  it("applies a snapshot that is ahead of the client", () => {
    // A client that missed `question-start` while its tab was suspended.
    const revealed = reducer(onQuestion(0), questionEnd(reveal(0)));

    const after = reducer(
      revealed,
      applySync(
        sync({
          phase: "question",
          qIndex: 1,
          question: question("q1"),
          remainingMs: 8_000,
        }),
      ),
    );

    expect(after.phase).toBe("question");
    expect(after.qIndex).toBe(1);
  });

  it("always applies the first snapshot on a fresh socket", () => {
    // useGameSocket resets the slice for every new socket, so whatever the
    // previous socket saw, a reconnect starts from the server's state.
    const after = reducer(
      fresh(),
      applySync(sync({ phase: "reveal", qIndex: 1, reveal: reveal(1) })),
    );

    expect(after.phase).toBe("reveal");
    expect(after.qIndex).toBe(1);
  });
});

describe("liveSummary", () => {
  const live = (index: number, answered: number) =>
    liveSummary({
      index,
      answered,
      summary: { type: "poll", counts: [answered, 0], responses: answered },
    });

  it("keeps the summary that counts the most answers", () => {
    let state = reducer(onQuestion(0), live(0, 3));
    state = reducer(state, live(0, 2));
    expect(state.liveSummary?.answered).toBe(3);
    state = reducer(state, live(0, 4));
    expect(state.liveSummary?.answered).toBe(4);
  });

  it("ignores a summary for another question", () => {
    const state = reducer(onQuestion(1), live(0, 3));
    expect(state.liveSummary).toBeNull();
  });

  it("clears when the next question opens or the snapshot moves on", () => {
    const held = reducer(onQuestion(0), live(0, 3));
    expect(
      reducer(
        held,
        questionStart({
          index: 1,
          qCount: 3,
          question: question("q1"),
          remainingMs: 10_000,
        }),
      ).liveSummary,
    ).toBeNull();
    // A same-question snapshot keeps it; the host is re-sent one right after.
    expect(
      reducer(held, applySync(sync({ phase: "question", qIndex: 0 })))
        .liveSummary?.answered,
    ).toBe(3);
    expect(
      reducer(held, applySync(sync({ phase: "reveal", qIndex: 0 })))
        .liveSummary,
    ).toBeNull();
  });
});

describe("standing", () => {
  const result = (rank: number, totalScore: number) => ({
    answered: true,
    answer: null,
    isCorrect: true,
    score: 0,
    totalScore,
    rank,
  });

  it("outlives the next question and tracks the move", () => {
    let s = reducer(onQuestion(0), answerResult(result(4, 500)));
    expect(s.standing).toEqual({
      qIndex: 0,
      rank: 4,
      totalScore: 500,
      previousRank: null,
    });
    s = onQuestion(1, s);
    expect(s.you).toBeNull();
    expect(s.standing?.rank).toBe(4);
    s = reducer(s, answerResult(result(2, 1400)));
    expect(s.standing).toMatchObject({ qIndex: 1, rank: 2, previousRank: 4 });
    // The reveal's own sync doesn't erase the move.
    s = reducer(
      s,
      applySync(sync({ phase: "reveal", qIndex: 1, you: result(2, 1400) })),
    );
    expect(s.standing).toMatchObject({ rank: 2, previousRank: 4 });
  });

  it("keeps a fresh result over a late snapshot of the same question", () => {
    let s = reducer(onQuestion(1), answerResult(result(2, 1400)));
    s = reducer(
      s,
      applySync(sync({ phase: "question", qIndex: 1, you: result(5, 300) })),
    );
    expect(s.standing).toMatchObject({ qIndex: 1, rank: 2 });
  });

  it("takes the last reveal's standing from a mid-question sync", () => {
    const s = reducer(
      fresh(),
      applySync(sync({ phase: "question", qIndex: 2, you: result(3, 900) })),
    );
    expect(s.standing).toMatchObject({ qIndex: 1, rank: 3 });
    expect(
      reducer(
        fresh(),
        applySync(sync({ phase: "question", qIndex: 0, you: result(1, 0) })),
      ).standing,
    ).toBeNull();
  });
});

describe("reactionBudgetKnown", () => {
  it("keeps the budget for bars mounted later; a reset counts", () => {
    let s = reducer(
      fresh(),
      reactionBudgetKnown({ limit: 5, windowMs: 60_000, players: 40 }),
    );
    expect(s.reactionBudget).toMatchObject({ limit: 5, resetSeq: 0 });
    expect(s.roomSize).toBe(40);
    s = reducer(
      s,
      reactionBudgetKnown({ limit: 5, windowMs: 60_000, reset: true }),
    );
    s = reducer(
      s,
      reactionBudgetKnown({ limit: 2, windowMs: 60_000, reset: true }),
    );
    expect(s.reactionBudget).toMatchObject({ limit: 2, resetSeq: 2 });
  });
});
