import { NotFoundException } from "@nestjs/common";
import { createGameSessionSchema, quizSettingsSchema } from "@buzrr/contract";
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

/** The "Host quiz" dialog: a game's own settings, optionally the quiz's new default. */
describe("GameSessionsService.createRoom with settings (Postgres)", () => {
  let dbUp = false;
  let hostId = "";
  let otherId = "";
  let quizId = "";
  let service: GameSessionsService;
  const user = () => ({ userId: hostId }) as never;
  const body = (b: unknown) => createGameSessionSchema.parse(b);

  beforeAll(async () => {
    dbUp = await requireDatabase();
    if (!dbUp) return;
    hostId = await createUser();
    otherId = await createUser();
    const quiz = await prisma.quiz.create({
      data: {
        title: "Room settings",
        userId: hostId,
        settings: { reactions: true },
      },
    });
    quizId = quiz.id;
    const entitlements = new EntitlementsService(
      prismaService,
      billingConfig({ BILLING: "OFF" }),
    );
    service = new GameSessionsService(
      prismaService,
      {} as unknown as GameEngineService,
      entitlements,
    );
  });

  afterAll(async () => {
    if (!dbUp) return;
    await deleteUsers([hostId, otherId]);
  });

  it("without settings, the game has none of its own (the quiz's apply)", async () => {
    if (!dbUp) return;
    const { id } = await service.createRoom(user(), body({ quizId }));
    const room = await prisma.gameSession.findUnique({ where: { id } });
    expect(room?.settings).toBeNull();
  });

  it("stores the game's settings and leaves the quiz alone", async () => {
    if (!dbUp) return;
    const { id } = await service.createRoom(
      user(),
      body({ quizId, settings: { reactions: false } }),
    );
    const room = await prisma.gameSession.findUnique({ where: { id } });
    expect(room?.settings).toEqual(
      quizSettingsSchema.parse({ reactions: false }),
    );
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    expect(quiz?.settings).toEqual({ reactions: true });
  });

  it("saveAsDefault also writes them to the quiz", async () => {
    if (!dbUp) return;
    const settings = { moderation: { enabled: true }, reactions: false };
    await service.createRoom(
      user(),
      body({ quizId, settings, saveAsDefault: true }),
    );
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    expect(quiz?.settings).toEqual(quizSettingsSchema.parse(settings));
  });

  it("someone else's quiz: no room, and its settings stay", async () => {
    if (!dbUp) return;
    const before = await prisma.quiz.findUnique({ where: { id: quizId } });
    await expect(
      service.createRoom(
        { userId: otherId } as never,
        body({ quizId, settings: {}, saveAsDefault: true }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    const after = await prisma.quiz.findUnique({ where: { id: quizId } });
    expect(after?.settings).toEqual(before?.settings);
  });

  it("the body schema rejects invalid settings", () => {
    expect(
      createGameSessionSchema.safeParse({
        quizId,
        settings: { reactions: "yes" },
      }).success,
    ).toBe(false);
  });
});
