import { describe, expect, it } from "vitest";
import {
  advanceStreak,
  effectiveStreak,
  isValidTimeZone,
  localDay,
  previousDay,
} from "./daily-streak";

describe("localDay", () => {
  // 2026-10-15 20:00 UTC is already 16 Oct in India (UTC+5:30).
  const lateUtc = new Date("2026-10-15T20:00:00Z");

  it("uses the player's zone, not UTC", () => {
    expect(localDay(lateUtc, "Asia/Kolkata")).toBe("2026-10-16");
    expect(localDay(lateUtc, "UTC")).toBe("2026-10-15");
    expect(localDay(lateUtc, "America/Los_Angeles")).toBe("2026-10-15");
  });

  it("falls back to UTC for a missing or unknown zone", () => {
    expect(localDay(lateUtc, null)).toBe("2026-10-15");
    expect(localDay(lateUtc, "Mars/Olympus_Mons")).toBe("2026-10-15");
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
  });
});

describe("previousDay", () => {
  it("crosses month and year boundaries", () => {
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(previousDay("2027-01-01")).toBe("2026-12-31");
  });
});

describe("advanceStreak", () => {
  it("starts at 1", () => {
    expect(
      advanceStreak({ current: 0, best: 0, lastDay: null }, "2026-10-15"),
    ).toEqual({ current: 1, best: 1, lastDay: "2026-10-15", advanced: true });
  });

  it("counts once per day", () => {
    const prev = { current: 4, best: 9, lastDay: "2026-10-15" };
    expect(advanceStreak(prev, "2026-10-15")).toEqual({
      ...prev,
      advanced: false,
    });
  });

  it("extends from yesterday and raises the best", () => {
    expect(
      advanceStreak(
        { current: 9, best: 9, lastDay: "2026-10-14" },
        "2026-10-15",
      ),
    ).toEqual({ current: 10, best: 10, lastDay: "2026-10-15", advanced: true });
  });

  it("restarts after a missed day but keeps the best", () => {
    expect(
      advanceStreak(
        { current: 5, best: 21, lastDay: "2026-10-12" },
        "2026-10-15",
      ),
    ).toEqual({ current: 1, best: 21, lastDay: "2026-10-15", advanced: true });
  });
});

describe("effectiveStreak", () => {
  it("survives through yesterday and decays after", () => {
    expect(effectiveStreak(3, "2026-10-15", "2026-10-15")).toBe(3);
    expect(effectiveStreak(3, "2026-10-14", "2026-10-15")).toBe(3);
    expect(effectiveStreak(3, "2026-10-13", "2026-10-15")).toBe(0);
    expect(effectiveStreak(3, null, "2026-10-15")).toBe(0);
  });
});
