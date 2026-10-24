import { describe, expect, it } from "vitest";
import { matchTypedAnswer } from "@buzrr/contract";

describe("matchTypedAnswer", () => {
  const accepted = ["Black Hole Sun", "Soundgarden black hole sun"];

  it("matches regardless of case, accents and punctuation", () => {
    expect(matchTypedAnswer("black-hole SÜN!", accepted, false)).toMatchObject({
      correct: true,
      precision: 1,
    });
  });

  it("doesn't count spacing as a typo", () => {
    expect(matchTypedAnswer("blackholesun", accepted, false)).toMatchObject({
      correct: true,
      precision: 1,
    });
    expect(matchTypedAnswer("blakholesun", accepted, true)).toMatchObject({
      correct: true,
      matched: "Black Hole Sun",
    });
  });

  it("forgives typos only when asked", () => {
    expect(matchTypedAnswer("blakholesun", accepted, false).correct).toBe(
      false,
    );
    expect(matchTypedAnswer("white hole moon", accepted, true).correct).toBe(
      false,
    );
  });
});
