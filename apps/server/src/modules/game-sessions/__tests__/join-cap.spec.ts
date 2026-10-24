import { ForbiddenException } from "@nestjs/common";
import { prisma } from "@buzrr/prisma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EntitlementsService } from "../../billing/entitlements.service";
import type { GameEngineService } from "../../game-engine/game-engine.service";
import { GameSessionsService } from "../game-sessions.service";
import {
  billingConfig,
  createUser,
  deleteUsers,
  prismaService,
  requireDatabase,
} from "../../billing/__tests__/helpers";

/**
 * A crowd joining one room at once (a QR code on the screen) must fill it
 * to exactly its cap: the rest get a 403, nobody a 500 (2026-10-17: 409
 * joins failed with TransactionWriteConflict / P2028 at 510 players).
 */
describe("GameSessionsService.join under a crowd (Postgres)", () => {
  const LIMIT = 40;
  const CROWD = 50;
  let dbUp = false;
  let hostId = "";
  let gameCode = "";
  let playerIds: string[] = [];
  let service: GameSessionsService;
  const env = process.env.MAX_PLAYERS_NOBILLING;

  beforeAll(async () => {
    dbUp = await requireDatabase();
    if (!dbUp) return;
    process.env.MAX_PLAYERS_NOBILLING = String(LIMIT);
    hostId = await createUser();
    // The column defaults to 50, which would lift the cap above LIMIT.
    await prisma.user.update({
      where: { id: hostId },
      data: { hostSizeLimit: 0 },
    });
    const quiz = await prisma.quiz.create({
      data: { title: "Join cap", userId: hostId },
    });
    gameCode = `T${Date.now().toString(36).slice(-5).toUpperCase()}`;
    await prisma.gameSession.create({
      data: { quizId: quiz.id, creatorId: hostId, gameCode },
    });
    const players = await Promise.all(
      Array.from({ length: CROWD }, (_, i) =>
        prisma.player.create({ data: { name: `p${i}` } }),
      ),
    );
    playerIds = players.map((p) => p.id);
    const entitlements = new EntitlementsService(
      prismaService,
      billingConfig({ BILLING: "OFF" }),
    );
    const engine = {
      isBanned: async () => false,
    } as unknown as GameEngineService;
    service = new GameSessionsService(prismaService, engine, entitlements);
  });

  afterAll(async () => {
    if (env === undefined) delete process.env.MAX_PLAYERS_NOBILLING;
    else process.env.MAX_PLAYERS_NOBILLING = env;
    if (!dbUp) return;
    await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
    await deleteUsers([hostId]);
  });

  it(`lets exactly ${LIMIT} of ${CROWD} parallel joins in, the rest get 403`, async () => {
    if (!dbUp) return;
    const results = await Promise.allSettled(
      playerIds.map((id) => service.join(id, { gameCode })),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof ForbiddenException,
    );
    const other = results.filter(
      (r) =>
        r.status === "rejected" && !(r.reason instanceof ForbiddenException),
    );
    expect(other).toEqual([]);
    expect(ok).toHaveLength(LIMIT);
    expect(refused).toHaveLength(CROWD - LIMIT);
    const inRoom = await prisma.player.count({
      where: { game: { gameCode } },
    });
    expect(inRoom).toBe(LIMIT);
  });

  it("a re-join of the same room never hits the cap", async () => {
    if (!dbUp) return;
    const member = await prisma.player.findFirst({
      where: { game: { gameCode } },
    });
    await expect(service.join(member!.id, { gameCode })).resolves.toMatchObject(
      { playerId: member!.id },
    );
  });
});
