import { describe, expect, it, vi } from "vitest";
import type { LeaderboardEntry } from "@buzrr/contract";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { TypedServer } from "../../realtime/realtime.types";
import { answer, meta, player } from "../core/__tests__/fixtures";
import type { DuelBotService } from "../duel-bot.service";
import { GameEngineService } from "../game-engine.service";
import type { GameStoreService } from "../game-store.service";
import { CODE, FakeServer, MemoryStore } from "./fakes";

/**
 * A host-paced game saves its result the moment the final leaderboard shows,
 * then stays open until the host leaves. Ending it must not save again, and
 * someone leaving in between must stay in the result.
 */
function onLastReveal() {
  const store = new MemoryStore(
    meta({
      phase: "reveal",
      qCount: 2,
      qIndex: 1,
      qId: "q1",
      startedAt: Date.now() - 60_000,
    }),
    [player("p1"), player("p2")],
  );
  for (const q of [0, 1]) {
    void store.recordAnswer(CODE, q, "p1", answer(`q${q}-a`, { score: 500 }));
    void store.recordAnswer(CODE, q, "p2", answer(`q${q}-b`, { score: 100 }));
  }
  const create = vi.fn(async () => ({ id: "result-1" }));
  const prisma = {
    db: {
      gameResult: { create },
      player: { updateMany: vi.fn() },
      gameSession: { delete: vi.fn() },
      $transaction: vi.fn(async () => []),
    },
  };
  const io = new FakeServer();
  const engine = new GameEngineService(
    store as unknown as GameStoreService,
    prisma as unknown as PrismaService,
    { cancel: vi.fn(), arm: vi.fn() } as unknown as DuelBotService,
  );
  engine.setServer(io as unknown as TypedServer);
  return { store, io, engine, create };
}

describe("saving a classic game's result at its final leaderboard", () => {
  it("saves once on the final board, keeps a leaver, and ends on that save", async () => {
    const { store, io, engine, create } = onLastReveal();

    await engine.hostNext(CODE);
    expect(store.meta.phase).toBe("final");
    expect(create).toHaveBeenCalledTimes(1);
    expect(store.meta.resultId).toBe("result-1");
    expect(await engine.savedResultId(CODE)).toBe("result-1");

    // Someone leaves the final screen before the host closes the room.
    await store.removePlayer(CODE, "p2");
    await engine.endGame(CODE);

    expect(create).toHaveBeenCalledTimes(1);
    const [over] = io.events("game-over");
    const payload = over!.payload as {
      entries: LeaderboardEntry[];
      resultId?: string;
    };
    expect(payload.resultId).toBe("result-1");
    expect(payload.entries.map((e) => e.playerId)).toEqual(["p1", "p2"]);
    expect(store.deleted).toBe(true);
  });
});
