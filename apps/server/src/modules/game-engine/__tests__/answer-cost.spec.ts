import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { TypedServer } from "../../realtime/realtime.types";
import { meta, player, question } from "../core/__tests__/fixtures";
import type { DuelBotService } from "../duel-bot.service";
import { GameEngineService } from "../game-engine.service";
import { GameStoreService } from "../game-store.service";

/**
 * What one answer costs in Redis, measured on a real server with MONITOR
 * rather than estimated. Hosted Redis bills per command, and answers are
 * the hot path: every player sends one per question.
 *
 * Opt-in: runs only when REDIS_TEST_URL is set (CI sets it), and only ever
 * on DB 15, so it can't touch a dev or hosted instance by accident.
 */
const url = process.env.REDIS_TEST_URL;
const DB = 15;

/** Room broadcasts, each one PUBLISH through the Redis adapter in prod. */
class FakeServer {
  publishes: string[] = [];
  in() {
    return { fetchSockets: async () => [] };
  }
  to(room: string) {
    return {
      emit: (event: string) => {
        this.publishes.push(`${room}:${event}`);
      },
    };
  }
}

describe.skipIf(!url)("answer cost (real Redis)", () => {
  const redis = new Redis(url ?? "", { db: DB });
  const monitorClient = new Redis(url ?? "");
  const store = new GameStoreService(redis);
  let seen: { args: string[]; source: string }[] = [];
  let monitor: Awaited<ReturnType<Redis["monitor"]>>;
  const codes: string[] = [];

  beforeAll(async () => {
    monitor = await monitorClient.monitor();
    monitor.on("monitor", (_time, args: string[], source, database) => {
      if (Number(database) === DB) seen.push({ args, source });
    });
  });

  afterAll(async () => {
    for (const code of codes) {
      await store.deleteGame(code, 2);
    }
    monitor.disconnect();
    monitorClient.disconnect();
    redis.disconnect();
  });

  /**
   * Waits until MONITOR has reported everything sent so far — it streams
   * asynchronously, so commands can arrive after the call that sent them.
   */
  async function drain() {
    const marker = `marker-${randomUUID()}`;
    await redis.echo(marker);
    await vi.waitFor(() => {
      if (!seen.some((c) => c.args[1] === marker)) throw new Error("waiting");
    });
  }

  /** Runs `fn` and returns the commands Redis executed for it, in order. */
  async function measure(fn: () => Promise<unknown>) {
    await drain();
    seen = [];
    await fn();
    await drain();
    const commands = seen.filter(
      (c) => !(c.args[0] === "echo" && c.args[1]?.startsWith("marker-")),
    );
    const topLevel = commands
      .filter((c) => !c.source.includes("lua"))
      .map((c) => c.args[0].toLowerCase());
    return {
      /** What the client sent, MULTI/EXEC wrappers included. */
      topLevel,
      /** The same without MULTI/EXEC, which some providers don't bill. */
      billable: topLevel.filter((c) => c !== "multi" && c !== "exec"),
      /** Commands run inside Lua scripts. */
      inScripts: commands
        .filter((c) => c.source.includes("lua"))
        .map((c) => c.args[0].toLowerCase()),
    };
  }

  async function openGame(players: number) {
    const code = `COST-${randomUUID().slice(0, 8)}`;
    codes.push(code);
    const now = Date.now();
    await store.setQuestions(code, [question("q0"), question("q1")]);
    await store.patchMeta(
      code,
      meta({
        phase: "question",
        qCount: 2,
        qIndex: 0,
        qId: "q0",
        qStartAt: now,
        qDeadline: now + 60_000,
      }),
    );
    for (let i = 0; i < players; i++) {
      await store.upsertPlayer(code, player(`p${i}`));
    }
    const io = new FakeServer();
    const engine = new GameEngineService(
      store,
      {} as PrismaService,
      { cancel: () => {}, arm: () => {} } as unknown as DuelBotService,
    );
    engine.setServer(io as unknown as TypedServer);
    return { code, io, engine };
  }

  it("a duplicate answer costs one read and writes nothing", async () => {
    const { code, engine } = await openGame(3);
    await engine.submitAnswer(code, "p0", 0, { optionId: "q0-a" });

    const cost = await measure(() =>
      engine.submitAnswer(code, "p0", 0, { optionId: "q0-b" }),
    );

    expect(cost.topLevel).toEqual(["hgetall", "get", "hgetall", "eval"]);
    expect(cost.inScripts).toEqual(["hsetnx"]);
  });

  it("an answer that does not close the question", async () => {
    const { code, io, engine } = await openGame(10);

    const cost = await measure(() =>
      engine.submitAnswer(code, "p0", 0, { optionId: "q0-a" }),
    );

    // One pipelined read serves judging and the early close; one script
    // stores the answer, adds the score and returns who has answered.
    expect(cost.topLevel).toEqual(["hgetall", "get", "hgetall", "eval"]);
    expect(io.publishes).toEqual([`${code}:answer-count`]);
  });

  it("the last answer, which closes the question", async () => {
    const { code, io, engine } = await openGame(2);
    await engine.submitAnswer(code, "p0", 0, { optionId: "q0-a" });
    io.publishes = [];

    const cost = await measure(() =>
      engine.submitAnswer(code, "p1", 0, { optionId: "q0-b" }),
    );

    // The answer's own four, then the reveal: a full state load (meta, then
    // questions/roster/answers/scores), the phase write, the parked deadline.
    expect(cost.billable).toEqual([
      ...["hgetall", "get", "hgetall", "eval"],
      ...["hgetall", "get", "hgetall", "hgetall", "zrevrange"],
      ...["hset", "expire", "expire", "zadd"],
    ]);
    // Personal results go out in roster (hash) order, before the reveal.
    expect(io.publishes[0]).toBe(`${code}:answer-count`);
    expect(io.publishes.slice(1, 3).sort()).toEqual([
      "player:p0:answer-result",
      "player:p1:answer-result",
    ]);
    expect(io.publishes.slice(3)).toEqual([
      `${code}:question-end`,
      `${code}:leaderboard`,
    ]);
  });
});
