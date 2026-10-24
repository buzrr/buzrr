import { describe, expect, it } from "vitest";
import { DEFAULT_AI_MIX, allocateTypes } from "./ai-mix";

describe("allocateTypes", () => {
  it("splits by weight: many, few, few", () => {
    expect(allocateTypes(10, DEFAULT_AI_MIX)).toEqual({
      multipleChoice: 7,
      trueFalse: 2,
      typeAnswer: 1,
    });
  });

  it("always adds up to the total", () => {
    for (let n = 1; n <= 30; n++) {
      const c = allocateTypes(n, {
        multipleChoice: 2,
        trueFalse: 3,
        typeAnswer: 1,
      });
      expect(c.multipleChoice + c.trueFalse + c.typeAnswer).toBe(n);
    }
  });

  it("gives every chosen type one when there are enough questions", () => {
    expect(allocateTypes(3, DEFAULT_AI_MIX)).toEqual({
      multipleChoice: 1,
      trueFalse: 1,
      typeAnswer: 1,
    });
  });

  it("leaves out types set to none, and falls back to multiple choice", () => {
    expect(
      allocateTypes(5, { multipleChoice: 0, trueFalse: 2, typeAnswer: 0 }),
    ).toEqual({ multipleChoice: 0, trueFalse: 5, typeAnswer: 0 });
    expect(
      allocateTypes(4, { multipleChoice: 0, trueFalse: 0, typeAnswer: 0 }),
    ).toEqual({ multipleChoice: 4, trueFalse: 0, typeAnswer: 0 });
  });
});
