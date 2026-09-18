import { describe, expect, it } from "vitest";
import { ANSWER_GRACE_MS, resolveAnswerTiming } from "./answer-timing";

const qStartAt = 10_000;
const qDeadline = 20_000;

describe("resolveAnswerTiming", () => {
  it("measures elapsed time from the server receive time", () => {
    expect(
      resolveAnswerTiming({ receivedAt: 15_000, qStartAt, qDeadline }),
    ).toEqual({ accepted: true, timeTakenMs: 5_000 });
  });

  it("accepts an answer arriving inside the grace, scored at the deadline", () => {
    expect(
      resolveAnswerTiming({
        receivedAt: qDeadline + 100,
        qStartAt,
        qDeadline,
      }),
    ).toEqual({ accepted: true, timeTakenMs: qDeadline - qStartAt });
  });

  it("scores the last moment of the grace the same as the deadline", () => {
    expect(
      resolveAnswerTiming({
        receivedAt: qDeadline + ANSWER_GRACE_MS,
        qStartAt,
        qDeadline,
      }),
    ).toEqual({ accepted: true, timeTakenMs: qDeadline - qStartAt });
  });

  it("rejects anything arriving after the grace", () => {
    expect(
      resolveAnswerTiming({
        receivedAt: qDeadline + ANSWER_GRACE_MS + 1,
        qStartAt,
        qDeadline,
      }),
    ).toEqual({ accepted: false });
  });

  it("never reports negative elapsed time", () => {
    expect(
      resolveAnswerTiming({ receivedAt: qStartAt - 50, qStartAt, qDeadline }),
    ).toEqual({ accepted: true, timeTakenMs: 0 });
  });
});
