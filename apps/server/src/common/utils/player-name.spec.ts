import { describe, expect, it } from "vitest";
import { cleanPlayerName, isOffensiveName } from "./player-name";

describe("cleanPlayerName", () => {
  it("keeps letters, digits and _ up to 30", () => {
    expect(cleanPlayerName("Anna Lena!")).toBe("AnnaLena");
    expect(cleanPlayerName("x".repeat(40))).toHaveLength(30);
    expect(cleanPlayerName("<script>")).toBe("script");
  });
});

describe("isOffensiveName", () => {
  it.each([
    "fuck",
    "FuCk_you",
    "fuuuuck",
    "f_u_c_k",
    "sh1t",
    "B1tch99",
    "Arschloch",
    "Hurens0hn",
    "BigAss",
    "big_ass",
    "Asss",
    "c0ck",
    "Nazi_88",
  ])("rejects %s", (name) => {
    expect(isOffensiveName(name)).toBe(true);
  });

  it.each([
    "Anna",
    "Cassandra",
    "Assist",
    "As",
    "Hancock",
    "Peacock",
    "Dickens",
    "Therapist",
    "Sausage",
    "Mongolia",
    "BraveOtter",
    "Klassenbester",
    "Saurier",
  ])("lets %s through", (name) => {
    expect(isOffensiveName(name)).toBe(false);
  });
});
