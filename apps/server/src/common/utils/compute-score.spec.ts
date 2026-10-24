import { describe, expect, it } from "vitest";
import { UNLIMITED_TIME_OUT } from "@buzrr/contract";
import { computeScore } from "./compute-score";

describe("computeScore", () => {
  it("scores a question without a time limit over a minute", () => {
    expect(computeScore(true, 30_000, UNLIMITED_TIME_OUT)).toBe(550);
    expect(computeScore(true, 120_000, UNLIMITED_TIME_OUT)).toBe(100);
  });
});
