import { describe, expect, it, vi } from "vitest";
import { PlayerCleanupService, retentionDays } from "./player-cleanup.service";

describe("retentionDays", () => {
  it("defaults to 8 and never goes below the token's lifetime", () => {
    expect(retentionDays(undefined)).toBe(8);
    expect(retentionDays("abc")).toBe(8);
    expect(retentionDays("3")).toBe(8);
    expect(retentionDays("30")).toBe(30);
  });
});

/** A fake player table: ids with an age in days and whether in a room. */
function setup(rows: { id: string; ageDays: number; inRoom?: boolean }[]) {
  const now = new Date("2026-10-20T12:00:00Z");
  let table = rows.map((r) => ({
    id: r.id,
    gameId: r.inRoom ? "room" : null,
    createdAt: new Date(now.getTime() - r.ageDays * 86_400_000),
  }));
  const prisma = {
    db: {
      player: {
        findMany: vi.fn(async ({ where, take }) =>
          table
            .filter(
              (p) =>
                p.gameId === where.gameId && p.createdAt < where.createdAt.lt,
            )
            .slice(0, take)
            .map((p) => ({ id: p.id })),
        ),
        deleteMany: vi.fn(async ({ where }) => {
          const before = table.length;
          table = table.filter(
            (p) => !(where.id.in.includes(p.id) && p.gameId === where.gameId),
          );
          return { count: before - table.length };
        }),
      },
    },
  };
  let locked = false;
  const redis = {
    set: vi.fn(async () => (locked ? null : ((locked = true), "OK"))),
  };
  const config = { get: vi.fn(() => undefined) };
  const service = new PlayerCleanupService(
    prisma as never,
    config as never,
    redis as never,
  );
  return { service, now, left: () => table.map((p) => p.id) };
}

describe("PlayerCleanupService", () => {
  it("deletes old guests not in a room, and keeps the rest", async () => {
    const { service, now, left } = setup([
      { id: "old", ageDays: 30 },
      { id: "old-in-room", ageDays: 30, inRoom: true },
      { id: "recent", ageDays: 2 },
      { id: "token-still-valid", ageDays: 7.5 },
    ]);
    expect(await service.cleanup(now)).toEqual({ skipped: false, deleted: 1 });
    expect(left()).toEqual(["old-in-room", "recent", "token-still-valid"]);
  });

  it("runs once while another pass holds the lock", async () => {
    const { service, now } = setup([{ id: "old", ageDays: 30 }]);
    await service.cleanup(now);
    expect(await service.cleanup(now)).toEqual({ skipped: true });
  });

  it("works through a backlog in batches", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({
      id: `p${i}`,
      ageDays: 20,
    }));
    const { service, now, left } = setup(rows);
    expect(await service.cleanup(now)).toEqual({
      skipped: false,
      deleted: 2500,
    });
    expect(left()).toEqual([]);
  });
});
