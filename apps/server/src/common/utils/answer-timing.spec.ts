import { describe, expect, it } from "vitest";
import {
  ANSWER_GRACE_MS,
  MAX_CREDITED_RTT_MS,
  median,
  resolveAnswerTiming,
} from "./answer-timing";

const qStartAt = 10_000;
const qDeadline = 20_000;

describe("resolveAnswerTiming", () => {
  it("subtracts half the round trip from elapsed time", () => {
    expect(
      resolveAnswerTiming({
        receivedAt: 15_000,
        qStartAt,
        qDeadline,
        rttMs: 200,
      }),
    ).toEqual({ accepted: true, timeTakenMs: 4_900 });
  });

  it("accepts an answer arriving in the grace when its corrected time is in the window", () => {
    expect(
      resolveAnswerTiming({
        receivedAt: qDeadline + 100,
        qStartAt,
        qDeadline,
        rttMs: 200,
      }),
    ).toEqual({ accepted: true, timeTakenMs: 10_000 });
  });

  it("rejects an answer in the grace whose corrected time is past the deadline", () => {
    expect(
      resolveAnswerTiming({
        receivedAt: qDeadline + 100,
        qStartAt,
        qDeadline,
        rttMs: 100,
      }),
    ).toEqual({ accepted: false });
  });

  it("rejects anything arriving after the grace, whatever the round trip", () => {
    expect(
      resolveAnswerTiming({
        receivedAt: qDeadline + ANSWER_GRACE_MS + 1,
        qStartAt,
        qDeadline,
        rttMs: 10_000,
      }),
    ).toEqual({ accepted: false });
  });

  it("caps the credited round trip", () => {
    expect(
      resolveAnswerTiming({
        receivedAt: 15_000,
        qStartAt,
        qDeadline,
        rttMs: 5_000,
      }),
    ).toEqual({ accepted: true, timeTakenMs: 5_000 - MAX_CREDITED_RTT_MS / 2 });
  });

  it("never reports negative elapsed time", () => {
    expect(
      resolveAnswerTiming({
        receivedAt: qStartAt + 50,
        qStartAt,
        qDeadline,
        rttMs: 400,
      }),
    ).toEqual({ accepted: true, timeTakenMs: 0 });
  });
});

describe("median", () => {
  it("handles empty, odd and even sample sets", () => {
    expect(median([])).toBe(0);
    expect(median([300, 20, 80])).toBe(80);
    expect(median([40, 10, 30, 20])).toBe(25);
  });
});
