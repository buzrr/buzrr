import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../../prisma/prisma.service";
import { REDIS } from "../../redis/redis.constants";
import { BillingConfig } from "./billing.config";
import { isProSubscription } from "./entitlements.service";
import { RENEWAL_GRACE_MS } from "./plans";
import { SubscriptionSyncService } from "./subscription-sync.service";

export const RECONCILE_INTERVAL_MS = 12 * 60 * 60 * 1000;
/** Gives the boot path (migrations, Redis, Dodo client) time to settle. */
const FIRST_RUN_DELAY_MS = 60_000;
/**
 * One pass per interval across all instances. Slightly shorter than the
 * interval so the next scheduled pass on any instance can claim it again.
 */
const LOCK_KEY = "billing:reconcile:lock";
const LOCK_TTL_MS = 11 * 60 * 60 * 1000;
/** Upper bound on Dodo fetches per pass; the rest wait for the next one. */
const MAX_PER_PASS = 200;

export type ReconcileResult =
  | { skipped: true }
  | { skipped: false; checked: number; changed: number; failed: number };

/**
 * Safety net under the webhooks: every 12h, re-mirror from Dodo each
 * subscription whose renewal should already have happened (`active` past its
 * billing date), plus `on_hold` / `past_due` rows that haven't been synced in
 * a while (a missed recovery webhook would otherwise leave a paying user on
 * Free). Dodo's own state is the payment confirmation: a failed renewal moves
 * the subscription off `active`, a paid one moves `next_billing_date`.
 *
 * A row Dodo still reports as `active` but overdue past `RENEWAL_GRACE_MS`
 * already resolves to Free in `isProSubscription`; this job only logs it.
 *
 * Lazy on Redis (invariant #27): one `SET NX` per instance per interval.
 */
@Injectable()
export class BillingReconcileService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(BillingReconcileService.name);
  private firstRun: NodeJS.Timeout | null = null;
  private worker: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingConfig,
    private readonly sync: SubscriptionSyncService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.billing.enabled) return;
    this.firstRun = setTimeout(() => this.runSafely(), FIRST_RUN_DELAY_MS);
    this.firstRun.unref();
    this.worker = setInterval(() => this.runSafely(), RECONCILE_INTERVAL_MS);
    this.worker.unref();
  }

  onModuleDestroy(): void {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.worker) clearInterval(this.worker);
    this.firstRun = null;
    this.worker = null;
  }

  private runSafely(): void {
    void this.reconcile().catch((err) =>
      this.logger.error(
        "Billing reconcile pass failed",
        err instanceof Error ? err.stack : String(err),
      ),
    );
  }

  async reconcile(now: Date = new Date()): Promise<ReconcileResult> {
    if (!this.billing.enabled) return { skipped: true };
    const claim = await this.redis.set(LOCK_KEY, "1", "PX", LOCK_TTL_MS, "NX");
    if (claim !== "OK") {
      this.logger.log("Billing reconcile skipped: another pass holds the lock");
      return { skipped: true };
    }

    const staleBefore = new Date(now.getTime() - RECONCILE_INTERVAL_MS);
    const candidates = await this.prisma.db.subscription.findMany({
      where: {
        OR: [
          { status: "active", currentPeriodEnd: { lt: now } },
          {
            status: { in: ["on_hold", "past_due"] },
            lastSyncedAt: { lt: staleBefore },
          },
        ],
      },
      orderBy: { currentPeriodEnd: "asc" },
      take: MAX_PER_PASS,
      select: {
        dodoSubscriptionId: true,
        status: true,
        currentPeriodEnd: true,
      },
    });

    let changed = 0;
    let failed = 0;
    for (const before of candidates) {
      const id = before.dodoSubscriptionId;
      try {
        await this.sync.resync(id);
      } catch (err) {
        failed++;
        this.logger.error(
          `Reconcile of subscription ${id} failed`,
          err instanceof Error ? err.stack : String(err),
        );
        continue;
      }
      const after = await this.prisma.db.subscription.findUnique({
        where: { dodoSubscriptionId: id },
        select: {
          status: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      });
      if (!after) continue;
      if (
        after.status !== before.status ||
        after.currentPeriodEnd?.getTime() !== before.currentPeriodEnd?.getTime()
      ) {
        changed++;
      }
      if (
        after.status === "active" &&
        after.currentPeriodEnd !== null &&
        !isProSubscription(after, now)
      ) {
        this.logger.warn(
          `Subscription ${id} is still active in Dodo but its renewal is over ${
            RENEWAL_GRACE_MS / 3_600_000
          }h overdue; the account resolves to Free`,
        );
      }
    }

    this.logger.log(
      `Billing reconcile: ${candidates.length} checked, ${changed} changed, ${failed} failed`,
    );
    return { skipped: false, checked: candidates.length, changed, failed };
  }
}
