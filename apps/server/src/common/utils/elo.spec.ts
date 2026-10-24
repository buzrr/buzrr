import { describe, expect, it } from "vitest";
import {
  ELO_FLOOR,
  PROVISIONAL_GAMES,
  applyFloor,
  eloDelta,
  kFactor,
} from "./elo";

describe("kFactor", () => {
  it("is higher while the rating is provisional", () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(PROVISIONAL_GAMES - 1)).toBe(40);
    expect(kFactor(PROVISIONAL_GAMES)).toBe(24);
    expect(kFactor(500)).toBe(24);
  });
});

describe("eloDelta", () => {
  it("moves equal ratings by half of K", () => {
    expect(eloDelta(1200, 1200, 1, 24)).toBe(12);
    expect(eloDelta(1200, 1200, 0, 24)).toBe(-12);
    expect(eloDelta(1200, 1200, 0.5, 24)).toBe(0);
  });

  it("is symmetric between the two players", () => {
    for (const [a, b] of [
      [1200, 1500],
      [1800, 1100],
      [1000, 1040],
    ] as const) {
      for (const score of [1, 0.5, 0] as const) {
        const other = (1 - score) as 1 | 0.5 | 0;
        expect(eloDelta(a, b, score, 32) + eloDelta(b, a, other, 32)).toBe(0);
      }
    }
  });

  it("rewards beating a stronger player more than a weaker one", () => {
    expect(eloDelta(1200, 1600, 1, 24)).toBeGreaterThan(
      eloDelta(1200, 800, 1, 24),
    );
    // A draw against a stronger player still gains.
    expect(eloDelta(1200, 1600, 0.5, 24)).toBeGreaterThan(0);
  });

  it("never moves by more than K", () => {
    expect(Math.abs(eloDelta(100, 3000, 1, 40))).toBeLessThanOrEqual(40);
    expect(Math.abs(eloDelta(3000, 100, 0, 40))).toBeLessThanOrEqual(40);
  });
});

describe("applyFloor", () => {
  it("keeps ratings at or above the floor", () => {
    expect(applyFloor(ELO_FLOOR - 50)).toBe(ELO_FLOOR);
    expect(applyFloor(-1000)).toBe(ELO_FLOOR);
    expect(applyFloor(ELO_FLOOR)).toBe(ELO_FLOOR);
    expect(applyFloor(1234)).toBe(1234);
  });
});
