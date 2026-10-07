import { describe, expect, it } from "vitest";
import { ANSWER_GRACE_MS } from "../../../../common/utils/answer-timing";
import {
  DUEL_FORFEIT_MS,
  HOST_ABANDON_MS,
  botAnswerOf,
  canPause,
  forfeitOutcome,
  hasConnectedHuman,
  isHostAbandoned,
  overdueForfeiter,
  resumePlan,
} from "../lifecycle";
import { T0, duelMeta, meta, player } from "./fixtures";

describe("resumePlan", () => {
  it("shifts an open question's window and the bot's answer by the pause", () => {
    const paused = duelMeta({
      phase: "question",
      qStartAt: T0,
      qDeadline: T0 + 10_000,
      botAnswerAt: T0 + 4000,
      pausedAt: T0 + 2000,
    });
    const plan = resumePlan(paused, T0 + 12_000);
    expect(plan.pausedFor).toBe(10_000);
    expect(plan.patch).toEqual({
      qStartAt: T0 + 10_000,
      qDeadline: T0 + 20_000,
      botAnswerAt: T0 + 14_000,
    });
    expect(plan.fireAt).toBe(T0 + 20_000 + ANSWER_GRACE_MS);
  });

  it("fires a reveal at its shifted deadline, with no grace", () => {
    const paused = duelMeta({
      phase: "reveal",
      qDeadline: T0 + 4000,
      pausedAt: T0,
    });
    const plan = resumePlan(paused, T0 + 1000);
    expect(plan.fireAt).toBe(T0 + 5000);
    expect(plan.patch).toEqual({ qDeadline: T0 + 5000 });
  });

  it("re-opens at once a question paused before its window was stamped", () => {
    const paused = duelMeta({ phase: "question", pausedAt: T0 });
    expect(resumePlan(paused, T0 + 1000).fireAt).toBe(T0 + 1000);
  });
});

describe("pausing and presence", () => {
  it("only pauses an in-flight duel that isn't paused yet", () => {
    expect(canPause(duelMeta({ phase: "question" }))).toBe(true);
    expect(canPause(duelMeta({ phase: "final" }))).toBe(false);
    expect(canPause(duelMeta({ phase: "question", pausedAt: T0 }))).toBe(false);
  });

  it("never counts the bot as someone still playing", () => {
    const m = duelMeta({ botId: "bot_x" });
    const roster = [player("bot_x"), player("p1", { connected: false })];
    expect(hasConnectedHuman(m, roster)).toBe(false);
  });
});

describe("forfeits", () => {
  it("finds a human gone past the grace, never the bot", () => {
    const m = duelMeta({ botId: "bot_x" });
    const gone = T0 - DUEL_FORFEIT_MS - 1;
    const roster = [
      player("bot_x", { connected: false, lastSeenAt: gone }),
      player("p1", { connected: false, lastSeenAt: gone }),
    ];
    expect(overdueForfeiter(m, roster, T0)?.id).toBe("p1");
    expect(
      overdueForfeiter(m, [player("p1", { connected: false })], T0),
    ).toBeUndefined();
  });

  it("is a forfeit against the leaver while the opponent stays", () => {
    const roster = [
      player("p1", { connected: false, userId: "u1" }),
      player("p2"),
    ];
    expect(forfeitOutcome(roster, "p1")).toEqual({ forfeitLoserId: "u1" });
  });

  it("is abandoned when both are gone, and nothing once they are back", () => {
    const gone = [
      player("p1", { connected: false }),
      player("p2", { connected: false }),
    ];
    expect(forfeitOutcome(gone, "p1")).toEqual({ abandoned: true });
    expect(forfeitOutcome([player("p1")], "p1")).toBeNull();
  });
});

describe("isHostAbandoned", () => {
  const away = {
    hostConnected: false,
    hostLastSeenAt: T0 - HOST_ABANDON_MS - 1,
  };

  it("ends a host-paced game the host walked away from", () => {
    expect(isHostAbandoned(meta({ phase: "reveal", ...away }), T0)).toBe(true);
  });

  it("leaves lobbies and hostless games alone", () => {
    expect(isHostAbandoned(meta({ phase: "lobby", ...away }), T0)).toBe(false);
    expect(isHostAbandoned(duelMeta({ phase: "reveal", ...away }), T0)).toBe(
      false,
    );
  });
});

describe("botAnswerOf", () => {
  it("reads the stored answer", () => {
    expect(
      botAnswerOf(duelMeta({ botAnswer: JSON.stringify({ optionId: "o" }) })),
    ).toEqual({ optionId: "o" });
  });

  it("reads games planned before answers were type-agnostic", () => {
    expect(botAnswerOf(duelMeta({ botOptionId: "o" }))).toEqual({
      optionId: "o",
    });
  });

  it("ignores garbage", () => {
    expect(botAnswerOf(duelMeta({ botAnswer: "{nope" }))).toBeNull();
  });
});
