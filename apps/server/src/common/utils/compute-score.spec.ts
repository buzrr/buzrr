import { describe, expect, it } from "vitest";
import { UNLIMITED_TIME_OUT } from "@buzrr/contract";
import { computeScore } from "./compute-score";

describe("computeScore", () => {
  it("gives a wrong answer nothing, however fast", () => {
    expect(computeScore(false, 0, 20)).toBe(0);
    expect(computeScore(false, 5000, 20)).toBe(0);
  });

  it("gives 1000 for an instant right answer", () => {
    expect(computeScore(true, 0, 20)).toBe(1000);
  });

  it("gives 100 at or past the time limit", () => {
    expect(computeScore(true, 20_000, 20)).toBe(100);
    expect(computeScore(true, 99_000, 20)).toBe(100);
  });

  it("decays linearly in between", () => {
    expect(computeScore(true, 10_000, 20)).toBe(550);
    expect(computeScore(true, 5_000, 20)).toBe(775);
    expect(computeScore(true, 15_000, 20)).toBe(325);
  });

  it("clamps a negative time to zero", () => {
    expect(computeScore(true, -500, 20)).toBe(1000);
  });

  it("scores a question without a time limit over a minute", () => {
    expect(computeScore(true, 30_000, UNLIMITED_TIME_OUT)).toBe(550);
    expect(computeScore(true, 120_000, UNLIMITED_TIME_OUT)).toBe(100);
  });
});
