import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { prisma } from "@buzrr/prisma";
import type { SubscriptionStatus } from "@buzrr/prisma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EntitlementsService,
  isProSubscription,
} from "../entitlements.service";
import { PRO_AI_WINDOW_MS } from "../plans";
import {
  billingConfig,
  createSubscription,
  createUser,
  deleteUsers,
  prismaService,
  requireDatabase,
} from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

describe("isProSubscription", () => {
  const now = new Date("2026-09-14T12:00:00Z");
  const future = new Date(now.getTime() + DAY);
  const past = new Date(now.getTime() - DAY);

  it("grants Pro while active", () => {
    expect(
      isProSubscription(
        { status: "active", currentPeriodEnd: past, cancelAtPeriodEnd: false },
        now,
      ),
    ).toBe(true);
  });

  it("keeps Pro for a cancel-at-period-end subscription until the period ends", () => {
    const sub = { status: "cancelled" as const, cancelAtPeriodEnd: true };
    expect(isProSubscription({ ...sub, currentPeriodEnd: future }, now)).toBe(
      true,
    );
    expect(isProSubscription({ ...sub, currentPeriodEnd: past }, now)).toBe(
      false,
    );
    expect(isProSubscription({ ...sub, currentPeriodEnd: null }, now)).toBe(
      false,
    );
  });

  it("revokes Pro immediately on an immediate cancellation", () => {
    expect(
      isProSubscription(
        {
          status: "cancelled",
          currentPeriodEnd: future,
          cancelAtPeriodEnd: false,
        },
        now,
      ),
    ).toBe(false);
  });

  it.each<SubscriptionStatus>([
    "pending",
    "on_hold",
    "paused",
    "past_due",
    "failed",
    "expired",
  ])("treats %s as Free", (status) => {
    expect(
      isProSubscription(
        { status, currentPeriodEnd: future, cancelAtPeriodEnd: false },
        now,
      ),
    ).toBe(false);
  });
});

async function expectPlanLimit(promise: Promise<unknown>, limit: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(ForbiddenException);
  expect((error as ForbiddenException).getResponse()).toMatchObject({
    code: "PLAN_LIMIT",
    limit,
  });
}

describe("EntitlementsService (Postgres)", () => {
  const service = new EntitlementsService(prismaService, billingConfig());
  const userIds: string[] = [];
  let dbUp = false;

  async function user() {
    const id = await createUser();
    userIds.push(id);
    return id;
  }

  beforeAll(async () => {
    dbUp = await requireDatabase();
  });

  afterAll(async () => {
    if (dbUp) await deleteUsers(userIds);
  });

  it("resolves Free without a subscription and Pro with an active one", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    expect(await service.resolvePlan(userId)).toBe("free");
    await createSubscription(userId, { status: "on_hold" });
    expect(await service.resolvePlan(userId)).toBe("free");
    await createSubscription(userId, { status: "active" });
    expect(await service.resolvePlan(userId)).toBe("pro");
  });

  it("gives everyone Pro limits when billing is off", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const selfHosted = new EntitlementsService(
      prismaService,
      billingConfig({ BILLING: "OFF" }),
    );
    expect(await selfHosted.resolvePlan(userId)).toBe("pro");
  });

  it("caps room size by plan, keeping a higher manual override", async (ctx) => {
    if (!dbUp) ctx.skip();
    const free = await user();
    expect(await service.maxPlayersFor(free)).toBe(50);

    const pro = await user();
    await createSubscription(pro);
    expect(await service.maxPlayersFor(pro)).toBe(250);

    const raised = await user();
    await prisma.user.update({
      where: { id: raised },
      data: { hostSizeLimit: 300 },
    });
    expect(await service.maxPlayersFor(raised)).toBe(300);
  });

  it("stops a Free user at 10 quizzes, even under concurrent creates", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    await prisma.quiz.createMany({
      data: Array.from({ length: 9 }, (_, i) => ({
        title: `Quiz ${i}`,
        userId,
      })),
    });

    const attempt = () =>
      prisma.$transaction(async (tx) => {
        await service.assertQuizCapacity(tx, userId);
        await tx.quiz.create({ data: { title: "Racing quiz", userId } });
      });
    const results = await Promise.allSettled([attempt(), attempt()]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.quiz.count({ where: { userId } })).toBe(10);
    await expectPlanLimit(
      prisma.$transaction((tx) => service.assertQuizCapacity(tx, userId)),
      "quizzes",
    );
  });

  it("returns 404, not an FK error, for a token whose user no longer exists", async (ctx) => {
    if (!dbUp) ctx.skip();
    await expect(
      prisma.$transaction((tx) =>
        service.assertQuizCapacity(tx, "user-that-does-not-exist"),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("reports the live subscription, not a newer abandoned checkout", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    await createSubscription(userId, { status: "active" });
    await createSubscription(userId, { status: "pending" });

    const entitlements = await service.getEntitlements(userId);
    expect(entitlements.plan).toBe("pro");
    expect(entitlements.subscription?.status).toBe("active");
  });

  it("lets Pro users create past 10 quizzes", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    await createSubscription(userId);
    await prisma.quiz.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        title: `Quiz ${i}`,
        userId,
      })),
    });
    await expect(
      prisma.$transaction((tx) => service.assertQuizCapacity(tx, userId)),
    ).resolves.toBeUndefined();
  });

  it("gives Free users 3 lifetime AI tokens that never refill", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    for (const remaining of [2, 1, 0]) {
      const reservation = await service.reserveAiToken(userId, "quiz_ai");
      expect(reservation.remaining).toBe(remaining);
    }
    await expectPlanLimit(service.reserveAiToken(userId, "rag"), "ai_tokens");

    const entitlements = await service.getEntitlements(userId);
    expect(entitlements.usage).toMatchObject({
      aiTokensUsed: 3,
      aiTokensRemaining: 0,
      aiTokensResetAt: null,
    });
  });

  it("refunds a failed generation exactly once, and only with its release token", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const reservation = await service.reserveAiToken(userId, "quiz_ai");

    expect(
      await service.releaseAiToken(
        userId,
        reservation.reservationId,
        "wrong-token",
      ),
    ).toEqual({ refunded: false });
    expect(
      await service.releaseAiToken(
        userId,
        reservation.reservationId,
        reservation.releaseToken,
      ),
    ).toEqual({ refunded: true });
    expect(
      await service.releaseAiToken(
        userId,
        reservation.reservationId,
        reservation.releaseToken,
      ),
    ).toEqual({ refunded: false });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.freeAiTokensUsed).toBe(0);
  });

  it("gives Pro users 10 tokens per rolling week", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    await createSubscription(userId);

    for (let i = 0; i < 10; i++) {
      await service.reserveAiToken(userId, "rag");
    }
    await expectPlanLimit(service.reserveAiToken(userId, "rag"), "ai_tokens");
    expect(
      (await service.getEntitlements(userId)).usage.aiTokensResetAt,
    ).not.toBeNull();

    // Once the window has elapsed, the next reservation opens a fresh one.
    await prisma.user.update({
      where: { id: userId },
      data: {
        proAiWindowStart: new Date(Date.now() - PRO_AI_WINDOW_MS - 60_000),
      },
    });
    const next = await service.reserveAiToken(userId, "rag");
    expect(next.remaining).toBe(9);
  });

  it("never refunds an old window's token into a new window", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    await createSubscription(userId);

    const old = await service.reserveAiToken(userId, "rag");
    await prisma.user.update({
      where: { id: userId },
      data: {
        proAiWindowStart: new Date(Date.now() - PRO_AI_WINDOW_MS - 60_000),
      },
    });
    await service.reserveAiToken(userId, "rag");

    expect(
      await service.releaseAiToken(userId, old.reservationId, old.releaseToken),
    ).toEqual({ refunded: true });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.proAiTokensUsed).toBe(1);
  });

  it("keeps a Pro user's Free lifetime allowance untouched", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const sub = await createSubscription(userId);
    await service.reserveAiToken(userId, "quiz_ai");

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "expired" },
    });
    const entitlements = await service.getEntitlements(userId);
    expect(entitlements.plan).toBe("free");
    expect(entitlements.usage.aiTokensRemaining).toBe(3);
  });
});
