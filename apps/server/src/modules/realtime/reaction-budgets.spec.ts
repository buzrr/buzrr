import { REACTION_WINDOW_MS, reactionLimitFor } from "@buzrr/contract";
import { describe, expect, it } from "vitest";
import { ReactionBudgets } from "./reaction-budgets";

describe("reaction budgets", () => {
  it("scales with the room", () => {
    expect(reactionLimitFor(10)).toBe(30);
    expect(reactionLimitFor(49)).toBe(30);
    expect(reactionLimitFor(50)).toBe(10);
    expect(reactionLimitFor(149)).toBe(10);
    expect(reactionLimitFor(150)).toBe(5);
    expect(reactionLimitFor(499)).toBe(5);
    expect(reactionLimitFor(500)).toBe(2);
  });

  it("accepts the budget, then says how long to wait", () => {
    const b = new ReactionBudgets();
    for (let i = 0; i < 5; i++) {
      expect(b.take("ROOM", "p1", 5, 1000 + i).ok).toBe(true);
    }
    const sixth = b.take("ROOM", "p1", 5, 2000);
    expect(sixth).toEqual({ ok: false, retryInMs: REACTION_WINDOW_MS - 1000 });
    // Another player has their own budget.
    expect(b.take("ROOM", "p2", 5, 2000).ok).toBe(true);
  });

  it("starts afresh with a new question, and after the window", () => {
    const b = new ReactionBudgets();
    for (let i = 0; i < 5; i++) b.take("ROOM", "p1", 5, i);
    expect(b.take("ROOM", "p1", 5, 10).ok).toBe(false);
    b.reset("ROOM");
    expect(b.take("ROOM", "p1", 5, 11).ok).toBe(true);
    const c = new ReactionBudgets();
    for (let i = 0; i < 5; i++) c.take("ROOM", "p1", 5, i);
    expect(c.take("ROOM", "p1", 5, REACTION_WINDOW_MS + 5).ok).toBe(true);
  });

  it("is per player, so a reconnect gets no new budget", () => {
    const b = new ReactionBudgets();
    for (let i = 0; i < 2; i++) b.take("ROOM", "p1", 2, i);
    // Same player id from a new socket: still counted.
    expect(b.take("ROOM", "p1", 2, 5).ok).toBe(false);
  });
});
