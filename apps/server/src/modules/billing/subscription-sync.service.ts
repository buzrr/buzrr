import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import DodoPayments, { NotFoundError } from "dodopayments";
import type { Subscription as DodoSubscription } from "dodopayments/resources/subscriptions";
import type { Prisma, SubscriptionStatus } from "@buzrr/prisma";
import { BillingConfig } from "./billing.config";
import { DODO_CLIENT } from "./dodo.provider";

type Db = Prisma.TransactionClient;

const STATUSES: readonly SubscriptionStatus[] = [
  "pending",
  "active",
  "on_hold",
  "paused",
  "past_due",
  "cancelled",
  "failed",
  "expired",
];

function toStatus(value: string): SubscriptionStatus | null {
  return (STATUSES as readonly string[]).includes(value)
    ? (value as SubscriptionStatus)
    : null;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Copies Dodo's view of a subscription into the `subscriptions` table.
 *
 * Every write path (webhooks, the success-page sync) fetches the subscription
 * from Dodo and applies *that*, never the event payload's copy. Events arrive
 * unordered; a fresh fetch taken under a per-subscription lock always writes
 * the newest state, so a late `renewed` can't overwrite a newer `cancelled`.
 */
@Injectable()
export class SubscriptionSyncService {
  private readonly logger = new Logger(SubscriptionSyncService.name);

  constructor(
    @Inject(DODO_CLIENT) private readonly dodo: DodoPayments,
    private readonly billing: BillingConfig,
  ) {}

  /**
   * Serializes syncs of one subscription across requests and instances. Held
   * until the surrounding transaction ends, so fetch-then-write is atomic with
   * respect to any concurrent delivery for the same subscription.
   */
  async lock(tx: Db, dodoSubscriptionId: string): Promise<void> {
    // Wrapped in a subquery: selecting the `void` result directly can't be
    // deserialized by the Prisma client.
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${dodoSubscriptionId}))) AS l`;
  }

  /** `null` when Dodo has no such subscription (e.g. a dashboard test event). */
  async fetch(dodoSubscriptionId: string): Promise<DodoSubscription | null> {
    try {
      return await this.dodo.subscriptions.retrieve(dodoSubscriptionId);
    } catch (err) {
      if (err instanceof NotFoundError) return null;
      this.logger.error(
        `Dodo subscriptions.retrieve(${dodoSubscriptionId}) failed`,
        err instanceof Error ? err.stack : String(err),
      );
      // Non-2xx → Dodo redelivers the webhook later.
      throw new ServiceUnavailableException("Could not reach Dodo Payments");
    }
  }

  /**
   * Who a Dodo object belongs to. Only identifiers Buzrr itself put there or
   * already linked are trusted — never the customer's email.
   */
  async resolveUserId(
    tx: Db,
    ids: {
      metadataUserId?: unknown;
      dodoSubscriptionId?: string | null;
      dodoCustomerId?: string | null;
    },
  ): Promise<string | null> {
    if (typeof ids.metadataUserId === "string" && ids.metadataUserId) {
      const user = await tx.user.findUnique({
        where: { id: ids.metadataUserId },
        select: { id: true },
      });
      if (user) return user.id;
    }
    if (ids.dodoSubscriptionId) {
      const existing = await tx.subscription.findUnique({
        where: { dodoSubscriptionId: ids.dodoSubscriptionId },
        select: { userId: true },
      });
      if (existing?.userId) return existing.userId;
    }
    if (ids.dodoCustomerId) {
      const user = await tx.user.findUnique({
        where: { dodoCustomerId: ids.dodoCustomerId },
        select: { id: true },
      });
      if (user) return user.id;
    }
    return null;
  }

  /**
   * Upsert the mirror row. Returns the owning user id, or `null` when the
   * subscription isn't Buzrr Pro or can't be tied to an account (logged; the
   * event is still recorded so it isn't retried forever).
   */
  async apply(tx: Db, sub: DodoSubscription): Promise<string | null> {
    if (sub.product_id !== this.billing.proProductId) {
      this.logger.warn(
        `Ignoring subscription ${sub.subscription_id} for non-Pro product ${sub.product_id}`,
      );
      return null;
    }
    const status = toStatus(sub.status);
    if (!status) {
      this.logger.error(
        `Unknown Dodo subscription status "${sub.status}" on ${sub.subscription_id}`,
      );
      return null;
    }

    const dodoCustomerId = sub.customer.customer_id;
    const userId = await this.resolveUserId(tx, {
      metadataUserId: sub.metadata?.userId,
      dodoSubscriptionId: sub.subscription_id,
      dodoCustomerId,
    });
    if (!userId) {
      this.logger.warn(
        `Subscription ${sub.subscription_id} (customer ${dodoCustomerId}) matches no Buzrr user`,
      );
      return null;
    }

    const fields = {
      dodoCustomerId,
      productId: sub.product_id,
      status,
      currency: sub.currency,
      recurringAmount: sub.recurring_pre_tax_amount,
      currentPeriodStart: toDate(sub.previous_billing_date),
      currentPeriodEnd: toDate(sub.next_billing_date),
      cancelAtPeriodEnd: sub.cancel_at_next_billing_date,
      cancelledAt: toDate(sub.cancelled_at),
      lastSyncedAt: new Date(),
    };
    await tx.subscription.upsert({
      where: { dodoSubscriptionId: sub.subscription_id },
      create: { dodoSubscriptionId: sub.subscription_id, userId, ...fields },
      // Ownership is fixed at creation; a later event can't move a
      // subscription to a different account.
      update: fields,
    });

    await this.linkCustomer(tx, userId, dodoCustomerId);
    return userId;
  }

  /** Remember the Dodo customer so checkout and the portal reuse it. */
  async linkCustomer(
    tx: Db,
    userId: string,
    dodoCustomerId: string,
  ): Promise<void> {
    const holder = await tx.user.findUnique({
      where: { dodoCustomerId },
      select: { id: true },
    });
    if (holder) {
      if (holder.id !== userId) {
        this.logger.warn(
          `Dodo customer ${dodoCustomerId} is already linked to another user; not relinking`,
        );
      }
      return;
    }
    await tx.user.updateMany({
      where: { id: userId, dodoCustomerId: null },
      data: { dodoCustomerId },
    });
  }
}
