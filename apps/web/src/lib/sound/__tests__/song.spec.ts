import { describe, expect, it } from "vitest";
import { formatMs, parseMs, repeatOf } from "../song";

describe("song times", () => {
  it("reads mm:ss.mmm, seconds and a decimal comma", () => {
    expect(parseMs("1:05.250")).toBe(65_250);
    expect(parseMs("12.5")).toBe(12_500);
    expect(parseMs("0:07,1")).toBe(7_100);
    expect(parseMs("1:75")).toBeNull();
    expect(parseMs("abc")).toBeNull();
  });

  it("writes them back the same way", () => {
    expect(formatMs(65_250)).toBe("1:05.250");
    expect(parseMs(formatMs(123_456))).toBe(123_456);
  });
});

describe("repeat", () => {
  it("is on for the lobby only unless set, never for countdown / tusch", () => {
    expect(repeatOf("lobby", undefined)).toBe(true);
    expect(repeatOf("scores", undefined)).toBe(false);
    expect(repeatOf("scores", { repeat: true })).toBe(true);
    expect(repeatOf("countdown", { repeat: true })).toBe(false);
  });
});
