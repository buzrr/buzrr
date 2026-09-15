import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { AiTokenSource, Prisma, Subscription } from "@buzrr/prisma";
import { PrismaService } from "../../prisma/prisma.service";
import { BillingConfig } from "./billing.config";
import { PLAN_LIMITS, PRO_AI_WINDOW_MS } from "./plans";
import type { PlanId, PlanLimits } from "./plans";

/** Either the root client or an interactive-transaction client. */
type Db = Prisma.TransactionClient;

export type PlanLimitKind = "quizzes" | "ai_tokens";

export type Entitlements = {
  plan: PlanId;
  billingEnabled: boolean;
  limits: PlanLimits;
  usage: {
    quizCount: number;
    aiTokensUsed: number;
    aiTokensRemaining: number;
    /** When the Pro window refills; `null` on Free (lifetime) or an idle window. */
    aiTokensResetAt: string | null;
  };
  subscription: {
    status: Subscription["status"];
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    currency: string;
    recurringAmount: number;
  } | null;
};

/**
 * A subscription grants Pro while Dodo says it is `active`, or while a
 * cancel-at-period-end subscription is still inside the period it paid for.
 * `on_hold` (failed renewal), `failed`, `expired`, `pending` and an immediate
 * cancellation all resolve to Free.
 */
export function isProSubscription(
  sub: Pick<Subscription, "status" | "currentPeriodEnd" | "cancelAtPeriodEnd">,
  now: Date = new Date(),
): boolean {
  if (sub.status === "active") return true;
  return (
    sub.status === "cancelled" &&
    sub.cancelAtPeriodEnd &&
    sub.currentPeriodEnd !== null &&
    sub.currentPeriodEnd > now
  );
}

export function planLimitError(
  limit: PlanLimitKind,
  message: string,
  extra: Record<string, unknown> = {},
): ForbiddenException {
  // The object body passes through `AllExceptionsFilter` untouched, so the web
  // client can tell a plan limit from any other 403 and offer an upgrade.
  return new ForbiddenException({
    message,
    code: "PLAN_LIMIT",
    limit,
    ...extra,
  });
}

function hashReleaseToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * The single authority on what an account may do. Plans are read from the
 * `subscriptions` table on every call — never from the JWT, which lives 7 days
 * (same reasoning as `RolesGuard`, invariant #13).
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingConfig,
  ) {}

  async resolvePlan(userId: string, db: Db = this.prisma.db): Promise<PlanId> {
    if (!this.billing.enabled) return "pro";
    const subs = await db.subscription.findMany({
      where: { userId, status: { in: ["active", "cancelled"] } },
      select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    });
    const now = new Date();
    return subs.some((sub) => isProSubscription(sub, now)) ? "pro" : "free";
  }

  async getEntitlements(userId: string): Promise<Entitlements> {
    const [plan, user, quizCount, subscriptions] = await Promise.all([
      this.resolvePlan(userId),
      this.prisma.db.user.findUnique({
        where: { id: userId },
        select: {
          freeAiTokensUsed: true,
          proAiTokensUsed: true,
          proAiWindowStart: true,
        },
      }),
      this.prisma.db.quiz.count({ where: { userId } }),
      this.prisma.db.subscription.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    // Show the subscription that matters: one granting Pro, else the latest
    // that got past checkout, else whatever exists. An abandoned `pending`
    // checkout must never mask a live subscription.
    const now = new Date();
    const subscription =
      subscriptions.find((sub) => isProSubscription(sub, now)) ??
      subscriptions.find((sub) => sub.status !== "pending") ??
      subscriptions[0] ??
      null;

    const limits = PLAN_LIMITS[plan];
    let aiTokensUsed: number;
    let aiTokensResetAt: string | null = null;
    if (limits.ai.kind === "lifetime") {
      aiTokensUsed = user.freeAiTokensUsed;
    } else {
      const windowEnd = user.proAiWindowStart
        ? new Date(user.proAiWindowStart.getTime() + PRO_AI_WINDOW_MS)
        : null;
      const windowOpen = windowEnd !== null && windowEnd > new Date();
      aiTokensUsed = windowOpen ? user.proAiTokensUsed : 0;
      aiTokensResetAt = windowOpen ? windowEnd.toISOString() : null;
    }

    return {
      plan,
      billingEnabled: this.billing.enabled,
      limits,
      usage: {
        quizCount,
        aiTokensUsed,
        aiTokensRemaining: Math.max(0, limits.ai.amount - aiTokensUsed),
        aiTokensResetAt,
      },
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd:
              subscription.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            currency: subscription.currency,
            recurringAmount: subscription.recurringAmount,
          }
        : null,
    };
  }

  /**
   * Room-size cap for a host. `hostSizeLimit` survives as a manual override,
   * so an account an admin raised by hand never loses capacity on Free.
   */
  async maxPlayersFor(
    userId: string,
    db: Db = this.prisma.db,
  ): Promise<number> {
    const [plan, user] = await Promise.all([
      this.resolvePlan(userId, db),
      db.user.findUnique({
        where: { id: userId },
        select: { hostSizeLimit: true },
      }),
    ]);
    return Math.max(PLAN_LIMITS[plan].maxPlayers, user?.hostSizeLimit ?? 0);
  }

  /**
   * Call inside the transaction that creates the quiz. The user-row lock
   * serializes concurrent creates for one account, so two parallel requests
   * can't both see 9 quizzes and land on 11.
   */
  async assertQuizCapacity(tx: Db, userId: string): Promise<void> {
    // Lock before anything else. A missing row (e.g. a still-valid JWT for a
    // deleted account) becomes a 404 here instead of a foreign-key failure on
    // the quiz insert — on every plan, including unlimited ones.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    if (locked.length === 0) {
      throw new NotFoundException("User not found");
    }
    const plan = await this.resolvePlan(userId, tx);
    const max = PLAN_LIMITS[plan].maxQuizzes;
    if (max === null) return;
    const count = await tx.quiz.count({ where: { userId } });
    if (count >= max) {
      throw planLimitError(
        "quizzes",
        `You've reached the Free plan limit of ${max} quizzes. Delete a quiz or upgrade to Buzrr Pro for unlimited quizzes.`,
        { max },
      );
    }
  }

  /**
   * Spend one AI generation token. The counter update is a single conditional
   * UPDATE, so concurrent reservations can never overspend. The returned
   * `releaseToken` is the only way to refund this reservation — keep it
   * server-side.
   */
  async reserveAiToken(
    userId: string,
    source: AiTokenSource,
  ): Promise<{
    reservationId: string;
    releaseToken: string;
    remaining: number;
  }> {
    const plan = await this.resolvePlan(userId);
    const allowance = PLAN_LIMITS[plan].ai;
    const releaseToken = randomBytes(32).toString("base64url");
    const now = new Date();

    return this.prisma.db.$transaction(async (tx) => {
      let used: number;
      let windowStart: Date | null = null;

      if (allowance.kind === "weekly") {
        const cutoff = new Date(now.getTime() - PRO_AI_WINDOW_MS);
        // Every SET expression reads the pre-update row, so both CASEs see the
        // same "has the window expired?" answer.
        const rows = await tx.$queryRaw<{ used: number; window_start: Date }[]>`
          UPDATE "users" SET
            "pro_ai_window_start" = CASE
              WHEN "pro_ai_window_start" IS NULL OR "pro_ai_window_start" <= ${cutoff}
              THEN ${now} ELSE "pro_ai_window_start" END,
            "pro_ai_tokens_used" = CASE
              WHEN "pro_ai_window_start" IS NULL OR "pro_ai_window_start" <= ${cutoff}
              THEN 1 ELSE "pro_ai_tokens_used" + 1 END
          WHERE "id" = ${userId}
            AND ("pro_ai_window_start" IS NULL
              OR "pro_ai_window_start" <= ${cutoff}
              OR "pro_ai_tokens_used" < ${allowance.amount})
          RETURNING "pro_ai_tokens_used" AS used, "pro_ai_window_start" AS window_start`;
        const row = rows[0];
        if (!row) {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { proAiWindowStart: true },
          });
          if (!user) throw new NotFoundException("User not found");
          const resetsAt = user.proAiWindowStart
            ? new Date(user.proAiWindowStart.getTime() + PRO_AI_WINDOW_MS)
            : null;
          throw planLimitError(
            "ai_tokens",
            `You've used all ${allowance.amount} AI generations for this week.${resetsAt ? ` They refill on ${resetsAt.toUTCString()}.` : ""}`,
            {
              max: allowance.amount,
              resetsAt: resetsAt?.toISOString() ?? null,
            },
          );
        }
        used = row.used;
        windowStart = row.window_start;
      } else {
        const rows = await tx.$queryRaw<{ used: number }[]>`
          UPDATE "users" SET "free_ai_tokens_used" = "free_ai_tokens_used" + 1
          WHERE "id" = ${userId} AND "free_ai_tokens_used" < ${allowance.amount}
          RETURNING "free_ai_tokens_used" AS used`;
        const row = rows[0];
        if (!row) {
          const exists = await tx.user.count({ where: { id: userId } });
          if (!exists) throw new NotFoundException("User not found");
          throw planLimitError(
            "ai_tokens",
            `You've used all ${allowance.amount} free AI generations. Upgrade to Buzrr Pro for ${PLAN_LIMITS.pro.ai.amount} every week.`,
            { max: allowance.amount, resetsAt: null },
          );
        }
        used = row.used;
      }

      const reservation = await tx.aiTokenReservation.create({
        data: {
          userId,
          source,
          bucket: allowance.kind === "weekly" ? "pro" : "free",
          windowStart,
          releaseTokenHash: hashReleaseToken(releaseToken),
        },
        select: { id: true },
      });

      return {
        reservationId: reservation.id,
        releaseToken,
        remaining: Math.max(0, allowance.amount - used),
      };
    });
  }

  /**
   * Refund a reservation whose generation failed. Idempotent: the status flip
   * is conditional, so a retried or duplicated release refunds at most once.
   * A Pro refund only lands in the window the token came from — refunding into
   * a newer window would mint an extra token.
   */
  async releaseAiToken(
    userId: string,
    reservationId: string,
    releaseToken: string,
  ): Promise<{ refunded: boolean }> {
    return this.prisma.db.$transaction(async (tx) => {
      const flipped = await tx.aiTokenReservation.updateMany({
        where: {
          id: reservationId,
          userId,
          releaseTokenHash: hashReleaseToken(releaseToken),
          status: "consumed",
        },
        data: { status: "refunded" },
      });
      if (flipped.count === 0) return { refunded: false };

      const reservation = await tx.aiTokenReservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { bucket: true, windowStart: true },
      });
      if (reservation.bucket === "free") {
        await tx.$executeRaw`
          UPDATE "users" SET "free_ai_tokens_used" = GREATEST("free_ai_tokens_used" - 1, 0)
          WHERE "id" = ${userId}`;
      } else if (reservation.windowStart) {
        await tx.$executeRaw`
          UPDATE "users" SET "pro_ai_tokens_used" = GREATEST("pro_ai_tokens_used" - 1, 0)
          WHERE "id" = ${userId} AND "pro_ai_window_start" = ${reservation.windowStart}`;
      }
      return { refunded: true };
    });
  }
}
