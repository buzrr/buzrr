import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { SocketData, TypedServer } from "../../realtime/realtime.types";
import { meta, player } from "../core/__tests__/fixtures";
import type { DuelBotService } from "../duel-bot.service";
import { GameEngineService } from "../game-engine.service";
import type { GameMeta, RosterEntry } from "../game-engine.types";
import type { GameStoreService } from "../game-store.service";
import { CODE, FakeServer, MemoryStore } from "./fakes";

/**
 * The shell's presence handling, against an in-memory store and a fake
 * Socket.IO server. The question these specs pin down: when a socket closes,
 * is the person actually gone, or did they already reconnect on a new socket?
 * Getting it wrong marks a live player absent, and the early close then ends
 * the question as soon as everyone *else* has answered.
 */

function setup(m: GameMeta, players: RosterEntry[]) {
  const store = new MemoryStore(m, players);
  const io = new FakeServer();
  const bots = { cancel: vi.fn(), arm: vi.fn() };
  const engine = new GameEngineService(
    store as unknown as GameStoreService,
    {} as PrismaService,
    bots as unknown as DuelBotService,
  );
  engine.setServer(io as unknown as TypedServer);
  engines.push(engine);
  return { store, io, engine };
}

const engines: GameEngineService[] = [];
afterEach(() => {
  // Clears the lobby-grace / forfeit timers playerDisconnected arms.
  for (const e of engines.splice(0)) e.onApplicationShutdown();
});

/** A classic room with question 0 open and both players connected. */
function openQuestion() {
  const now = Date.now();
  return setup(
    meta({
      phase: "question",
      qCount: 2,
      qIndex: 0,
      qId: "q0",
      qStartAt: now,
      qDeadline: now + 10_000,
    }),
    [player("p1"), player("p2")],
  );
}

const gameSocket = (playerId: string): Partial<SocketData> => ({
  gameCode: CODE,
  playerId,
  isRoomHost: false,
});

describe("playerDisconnected", () => {
  it("ignores a stale socket closing while the player is on a newer one", async () => {
    const { store, io, engine } = openQuestion();
    io.rooms.set("player:p2", [gameSocket("p2")]);

    await engine.playerDisconnected(CODE, "p2");

    expect(store.players.get("p2")?.connected).toBe(true);
    expect(io.events("player-connection")).toEqual([]);
  });

  it("keeps the question open for a reconnected player whose old socket closed", async () => {
    // The reported bug: p2 reconnected, their old socket timed out later, and
    // p1's answer then closed the question before p2 could answer.
    const { store, io, engine } = openQuestion();
    io.rooms.set("player:p2", [gameSocket("p2")]);

    await engine.playerDisconnected(CODE, "p2");
    const ack = await engine.submitAnswer(CODE, "p1", 0, {
      optionId: "q0-a",
    });

    expect(ack).toMatchObject({ accepted: true });
    expect(io.events("question-end")).toEqual([]);
    expect(store.meta.phase).toBe("question");
  });

  it("still closes early once a player has really gone", async () => {
    const { store, io, engine } = openQuestion();

    await engine.playerDisconnected(CODE, "p2");
    await engine.submitAnswer(CODE, "p1", 0, { optionId: "q0-a" });

    expect(store.players.get("p2")?.connected).toBe(false);
    expect(io.events("player-connection")).toEqual([
      {
        room: CODE,
        event: "player-connection",
        payload: { playerId: "p2", connected: false },
      },
    ]);
    expect(io.events("question-end")).toHaveLength(1);
    expect(store.meta.phase).toBe("reveal");
  });

  it("undoes its write when a reconnect lands between the check and the write", async () => {
    const { store, io, engine } = openQuestion();
    // Empty at the first check; the new socket has joined by the re-check.
    io.fetchSockets
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ data: gameSocket("p2") }]);

    await engine.playerDisconnected(CODE, "p2");

    expect(store.players.get("p2")?.connected).toBe(true);
    expect(io.events("player-connection")).toEqual([]);
  });

  it("does not count the user's duel queue or invite sockets as being in the game", async () => {
    const { store, io, engine } = openQuestion();
    io.rooms.set("player:p2", [
      { gameCode: "", playerId: null, duelUserId: "p2" },
      { gameCode: "INVITE", playerId: null, duelInviteCode: "INVITE" },
      { gameCode: "OTHER1", playerId: "p2", isRoomHost: false },
    ]);

    await engine.playerDisconnected(CODE, "p2");

    expect(store.players.get("p2")?.connected).toBe(false);
  });

  it("marks the player gone when the presence lookup fails", async () => {
    const { store, io, engine } = openQuestion();
    io.fetchSockets.mockRejectedValue(new Error("adapter timeout"));

    await engine.playerDisconnected(CODE, "p2");

    expect(store.players.get("p2")?.connected).toBe(false);
  });
});

describe("hostDisconnected", () => {
  const hostSocket: Partial<SocketData> = {
    gameCode: CODE,
    playerId: null,
    isRoomHost: true,
  };

  it("ignores a stale host socket closing while the host is on a newer one", async () => {
    const { store, io, engine } = openQuestion();
    io.rooms.set(`host:${CODE}`, [hostSocket]);

    await engine.hostDisconnected(CODE);

    expect(store.meta.hostConnected).toBe(true);
  });

  it("marks the host gone when no host socket is left", async () => {
    const { store, engine } = openQuestion();

    await engine.hostDisconnected(CODE);

    expect(store.meta.hostConnected).toBe(false);
  });

  it("undoes its write when the host reconnects between the check and the write", async () => {
    const { store, io, engine } = openQuestion();
    io.fetchSockets
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ data: hostSocket }]);

    await engine.hostDisconnected(CODE);

    expect(store.meta.hostConnected).toBe(true);
  });
});
