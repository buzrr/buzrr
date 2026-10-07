import { describe, expect, it } from "vitest";
import { ANSWER_GRACE_MS } from "../../../../common/utils/answer-timing";
import { judgeAnswer } from "../answers";
import { T0, meta, player, questionOpen, state } from "./fixtures";

const submit = (optionId: string, qIndex = 0, playerId = "p1") => ({
  playerId,
  qIndex,
  answer: { optionId },
});

describe("judgeAnswer", () => {
  const open = questionOpen();

  it("scores a correct answer on the server's clock", () => {
    const result = judgeAnswer(open, submit("q1-a"), T0 + 1000);
    expect(result).toEqual({
      accepted: true,
      stored: {
        answer: { optionId: "q1-a" },
        answeredAt: T0 + 1000,
        timeTakenMs: 1000,
        isCorrect: true,
        // 1000 → 100 over a 10s window
        score: 910,
      },
    });
  });

  it("stores a wrong answer at zero points", () => {
    const result = judgeAnswer(open, submit("q1-b"), T0 + 1000);
    expect(result).toMatchObject({
      accepted: true,
      stored: { isCorrect: false, score: 0 },
    });
  });

  it("scores an answer inside the grace as if it landed on the deadline", () => {
    const at = open.meta.qDeadline + ANSWER_GRACE_MS;
    expect(judgeAnswer(open, submit("q1-a"), at)).toMatchObject({
      accepted: true,
      stored: { timeTakenMs: 10_000, score: 100 },
    });
  });

  it.each([
    ["after the grace", questionOpen(), submit("q1-a"), "Time is up", 1],
    [
      "outside a question",
      state({ meta: meta({ phase: "reveal" }) }),
      submit("q1-a"),
      "No question is active",
      0,
    ],
    [
      "for a question that has moved on",
      questionOpen(),
      submit("q1-a", 1),
      "Question already advanced",
      0,
    ],
    [
      "before the window was stamped",
      questionOpen({}, { qStartAt: 0 }),
      submit("q1-a"),
      "Question has not started",
      0,
    ],
    [
      "from outside the roster",
      questionOpen({ roster: [player("p2")] }),
      submit("q1-a"),
      "Not in this game",
      0,
    ],
    [
      "naming an option the question doesn't have",
      questionOpen(),
      submit("q2-a"),
      "Invalid answer",
      0,
    ],
  ])("rejects an answer %s", (_label, s, input, reason, late) => {
    const at = late
      ? s.meta.qDeadline + ANSWER_GRACE_MS + 1
      : s.meta.qStartAt + 500;
    expect(judgeAnswer(s, input, at)).toEqual({ accepted: false, reason });
  });

  it("rejects an answer of the wrong shape for the question's type", () => {
    const result = judgeAnswer(
      open,
      { playerId: "p1", qIndex: 0, answer: { text: "Paris" } },
      T0 + 500,
    );
    expect(result).toEqual({ accepted: false, reason: "Invalid answer" });
  });
});
