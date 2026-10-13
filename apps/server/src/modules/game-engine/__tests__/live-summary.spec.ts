import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { TypedServer } from "../../realtime/realtime.types";
import { meta, player, question } from "../core/__tests__/fixtures";
import type { DuelBotService } from "../duel-bot.service";
import { GameEngineService } from "../game-engine.service";
import type { LiveQuestion } from "../game-engine.types";
import type { GameStoreService } from "../game-store.service";
import { CODE, FakeServer, MemoryStore } from "./fakes";

/**
 * Unscored questions send the host a running summary — coalesced to one per
 * tick, never per answer, and never for scored types (the host screen is
 * projected, so it would give the answer away).
 */

const poll: LiveQuestion = {
  id: "poll",
  type: "poll",
  title: "Where next?",
  media: null,
  mediaType: null,
  timeOut: 20,
  options: [
    { id: "a", title: "Goa", isCorrect: false },
    { id: "b", title: "Manali", isCorrect: false },
  ],
  config: { multiSelect: false },
};

const engines: GameEngineService[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.onApplicationShutdown();
  vi.useRealTimers();
});

function setup(q: LiveQuestion) {
  vi.useFakeTimers();
  const now = Date.now();
  const store = new MemoryStore(
    meta({
      phase: "question",
      qCount: 1,
      qIndex: 0,
      qId: q.id,
      qStartAt: now,
      qDeadline: now + 20_000,
    }),
    // Three players, so two answers don't close the question early.
    [player("p1"), player("p2"), player("p3")],
    [q],
  );
  const io = new FakeServer();
  const engine = new GameEngineService(
    store as unknown as GameStoreService,
    {} as PrismaService,
    { cancel: vi.fn(), arm: vi.fn() } as unknown as DuelBotService,
  );
  engine.setServer(io as unknown as TypedServer);
  engines.push(engine);
  return { io, engine };
}

describe("live summary", () => {
  it("coalesces a burst of poll answers into one host-only summary", async () => {
    const { io, engine } = setup(poll);
    await engine.submitAnswer(CODE, "p1", 0, { optionIds: ["a"] });
    await engine.submitAnswer(CODE, "p2", 0, { optionIds: ["b"] });
    expect(io.events("live-summary")).toEqual([]);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(io.events("live-summary")).toEqual([
      {
        room: `host:${CODE}`,
        event: "live-summary",
        payload: {
          index: 0,
          answered: 2,
          summary: { type: "poll", counts: [1, 1], responses: 2 },
        },
      },
    ]);
  });

  it("never sends one for a scored question", async () => {
    const { io, engine } = setup(question("q0"));
    await engine.submitAnswer(CODE, "p1", 0, { optionId: "q0-a" });
    await vi.advanceTimersByTimeAsync(2_000);
    await engine.sendLiveSummary(CODE);
    expect(io.events("live-summary")).toEqual([]);
  });
});

describe("multiple submissions", () => {
  const openText = (multipleSubmissions: boolean): LiveQuestion => ({
    id: "open",
    type: "open_text",
    title: "One thing to start doing?",
    media: null,
    mediaType: null,
    timeOut: 45,
    options: [],
    config: { maxLength: 200, allowAnonymous: true, multipleSubmissions },
  });

  function solo(q: LiveQuestion) {
    vi.useFakeTimers();
    const now = Date.now();
    const store = new MemoryStore(
      meta({
        phase: "question",
        qCount: 1,
        qIndex: 0,
        qId: q.id,
        qStartAt: now,
        qDeadline: now + 45_000,
      }),
      [player("p1")],
      [q],
    );
    const io = new FakeServer();
    const engine = new GameEngineService(
      store as unknown as GameStoreService,
      {} as PrismaService,
      { cancel: vi.fn(), arm: vi.fn() } as unknown as DuelBotService,
    );
    engine.setServer(io as unknown as TypedServer);
    engines.push(engine);
    return { store, io, engine };
  }

  it("folds further answers in and keeps the question open", async () => {
    const { store, io, engine } = solo(openText(true));
    await engine.submitAnswer(CODE, "p1", 0, {
      text: "Demos",
      anonymous: false,
    });
    const ack = await engine.submitAnswer(CODE, "p1", 0, {
      text: "Fewer meetings",
      anonymous: true,
    });

    expect(ack).toEqual({
      accepted: true,
      answer: {
        entries: [
          { text: "Demos", anonymous: false },
          { text: "Fewer meetings", anonymous: true },
        ],
      },
    });
    // The only player has answered, but the question runs to its deadline.
    expect(io.events("question-end")).toEqual([]);
    expect(store.meta.phase).toBe("question");
  });

  it("stays first-write-wins when the setting is off", async () => {
    const { store, engine } = solo(openText(false));
    await engine.submitAnswer(CODE, "p1", 0, {
      text: "Demos",
      anonymous: false,
    });
    expect(store.meta.phase).toBe("reveal");
    const ack = await engine.submitAnswer(CODE, "p1", 0, {
      text: "Again",
      anonymous: false,
    });
    expect(ack.accepted).toBe(false);
  });
});
