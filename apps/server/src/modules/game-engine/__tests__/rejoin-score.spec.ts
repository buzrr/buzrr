import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { afterAll, describe, expect, it } from "vitest";
import { player } from "../core/__tests__/fixtures";
import { GameStoreService } from "../game-store.service";

/**
 * A player who leaves (or is removed) and comes back keeps their points: the
 * score is parked on removal and restored when they register again. Their
 * answers stay where they were all along.
 *
 * Opt-in like answer-cost.spec: runs only when REDIS_TEST_URL is set, on DB 15.
 */
const url = process.env.REDIS_TEST_URL;
const DB = 15;

describe.skipIf(!url)("rejoin keeps the score (real Redis)", () => {
  const redis = new Redis(url ?? "", { db: DB });
  const store = new GameStoreService(redis);
  const codes: string[] = [];

  afterAll(async () => {
    for (const code of codes) await store.deleteGame(code, 1);
    redis.disconnect();
  });

  const room = async () => {
    const code = `T${randomUUID().slice(0, 8)}`;
    codes.push(code);
    await store.upsertPlayerUnlessBanned(code, player("p1"));
    await redis.zadd(`game:${code}:lb`, 700, "p1");
    return code;
  };

  it("parks the score on removal and restores it on rejoin", async () => {
    const code = await room();

    await store.removePlayer(code, "p1");
    expect(await redis.zscore(`game:${code}:lb`, "p1")).toBeNull();
    expect(await store.getPlayer(code, "p1")).toBeNull();

    expect(await store.upsertPlayerUnlessBanned(code, player("p1"))).toBe(true);
    expect(await redis.zscore(`game:${code}:lb`, "p1")).toBe("700");
    expect(await redis.hlen(`game:${code}:departed`)).toBe(0);
  });

  it("gives a banned player nothing back", async () => {
    const code = await room();

    await store.banPlayer(code, "p1");
    await store.removePlayer(code, "p1");

    expect(await store.upsertPlayerUnlessBanned(code, player("p1"))).toBe(
      false,
    );
    expect(await redis.zscore(`game:${code}:lb`, "p1")).toBeNull();
  });

  it("leaves a fresh player's score alone", async () => {
    const code = await room();

    expect(await store.upsertPlayerUnlessBanned(code, player("p2"))).toBe(true);
    expect(await redis.zscore(`game:${code}:lb`, "p2")).toBeNull();
    expect(await redis.zscore(`game:${code}:lb`, "p1")).toBe("700");
  });

  it("deleteGame clears the parked scores", async () => {
    const code = await room();
    await store.removePlayer(code, "p1");

    await store.deleteGame(code, 1);

    expect(await redis.exists(`game:${code}:departed`)).toBe(0);
  });
});
