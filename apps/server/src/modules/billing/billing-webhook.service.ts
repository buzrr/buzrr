import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { IncomingHttpHeaders } from "node:http";
import DodoPayments, { NotFoundError } from "dodopayments";
import type { Payment as DodoPayment } from "dodopayments/resources/payments";
import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";
import { PrismaService } from "../../prisma/prisma.service";
import { BillingConfig } from "./billing.config";
import { DODO_CLIENT } from "./dodo.provider";
import { SubscriptionSyncService } from "./subscription-sync.service";

/** Events that can change a Pro entitlement or its audit trail. */
export const HANDLED_EVENT_TYPES = new Set<UnwrapWebhookEvent["type"]>([
  "payment.succeeded",
  "payment.failed",
  "subscription.active",
  "subscription.renewed",
  "subscription.on_hold",
  "subscription.paused",
  "subscription.unpaused",
  "subscription.past_due",
  "subscription.cancelled",
  "subscription.expired",
  "subscription.failed",
  "subscription.plan_changed",
  "subscription.updated",
  "refund.succeeded",
  "dispute.lost",
]);

type RelatedIds = {
  subscriptionId: string | null;
  payment: DodoPayment | null;
  paymentId: string | null;
};

function headerValue(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Applies verified Dodo webhooks. This is the only code (besides the
 * success-page sync, which fetches from Dodo the same way) that writes
 * `subscriptions` — the web app's `/api/webhooks/dodo` route verifies and
 * forwards here, and this service verifies again rather than trusting the hop.
 */
@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(
    @Inject(DODO_CLIENT) private readonly dodo: DodoPayments,
    private readonly prisma: PrismaService,
    private readonly billing: BillingConfig,
    private readonly sync: SubscriptionSyncService,
  ) {}

  async handle(
    rawBody: Buffer | undefined,
    headers: IncomingHttpHeaders,
  ): Promise<{ received: true }> {
    this.billing.requireEnabled();
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException("Missing webhook body");
    }

    const webhookId = headerValue(headers, "webhook-id");
    let event: UnwrapWebhookEvent;
    try {
      // Verifies the Standard Webhooks signature over the exact raw bytes,
      // including the timestamp tolerance that rejects replays.
      event = this.dodo.webhooks.unwrap(rawBody.toString("utf8"), {
        headers: {
          "webhook-id": webhookId,
          "webhook-signature": headerValue(headers, "webhook-signature"),
          "webhook-timestamp": headerValue(headers, "webhook-timestamp"),
        },
        key: this.billing.webhookKey,
      });
    } catch {
      throw new UnauthorizedException("Invalid webhook signature");
    }
    if (!webhookId) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    if (!HANDLED_EVENT_TYPES.has(event.type)) {
      return { received: true };
    }

    const related = await this.relatedIds(event);
    if (related === null) {
      return { received: true };
    }

    await this.prisma.db.$transaction(
      async (tx) => {
        // The idempotency claim commits with the effects: if anything below
        // throws, the claim rolls back too and Dodo's redelivery can retry.
        const claim = await tx.billingEvent.createMany({
          data: [
            {
              webhookId,
              type: event.type,
              objectId: related.subscriptionId ?? related.paymentId,
            },
          ],
          skipDuplicates: true,
        });
        if (claim.count === 0) return;

        let userId: string | null = null;
        if (related.subscriptionId) {
          await this.sync.lock(tx, related.subscriptionId);
          const subscription = await this.sync.fetch(related.subscriptionId);
          if (subscription) {
            userId = await this.sync.apply(tx, subscription);
          } else {
            this.logger.warn(
              `${event.type} ${webhookId}: subscription ${related.subscriptionId} not found in Dodo`,
            );
          }
        }

        if (
          event.type === "payment.succeeded" ||
          event.type === "payment.failed"
        ) {
          const payment = event.data;
          userId ??= await this.sync.resolveUserId(tx, {
            metadataUserId: payment.metadata?.userId,
            dodoSubscriptionId: payment.subscription_id,
            dodoCustomerId: payment.customer.customer_id,
          });
          const fields = {
            status:
              payment.status ??
              (event.type === "payment.succeeded" ? "succeeded" : "failed"),
            amount: payment.total_amount,
            currency: payment.currency,
            dodoSubscriptionId: payment.subscription_id ?? null,
            ...(userId ? { userId } : {}),
          };
          await tx.payment.upsert({
            where: { dodoPaymentId: payment.payment_id },
            create: { dodoPaymentId: payment.payment_id, ...fields },
            update: fields,
          });
        }

        if (
          event.type === "refund.succeeded" ||
          event.type === "dispute.lost"
        ) {
          // Access follows Dodo's subscription status (synced above); a refund
          // or lost dispute alone doesn't revoke Pro. Surface it for review.
          this.logger.warn(
            `${event.type} on payment ${related.paymentId} (subscription ${related.subscriptionId ?? "none"}, user ${userId ?? "unknown"}) — review manually`,
          );
        }
      },
      // Covers the Dodo fetch taken under the subscription lock.
      { maxWait: 5_000, timeout: 20_000 },
    );

    return { received: true };
  }

  /**
   * The subscription (and payment) an event concerns. Refunds and disputes only
   * name a payment, so that one link is fetched before the transaction —
   * payment→subscription never changes, so it's safe to read unlocked.
   */
  private async relatedIds(
    event: UnwrapWebhookEvent,
  ): Promise<RelatedIds | null> {
    switch (event.type) {
      case "payment.succeeded":
      case "payment.failed":
        return {
          subscriptionId: event.data.subscription_id ?? null,
          payment: event.data,
          paymentId: event.data.payment_id,
        };
      case "subscription.active":
      case "subscription.renewed":
      case "subscription.on_hold":
      case "subscription.paused":
      case "subscription.unpaused":
      case "subscription.past_due":
      case "subscription.cancelled":
      case "subscription.expired":
      case "subscription.failed":
      case "subscription.plan_changed":
      case "subscription.updated":
        return {
          subscriptionId: event.data.subscription_id,
          payment: null,
          paymentId: null,
        };
      case "refund.succeeded":
      case "dispute.lost": {
        const paymentId = event.data.payment_id;
        let payment: DodoPayment | null = null;
        try {
          payment = await this.dodo.payments.retrieve(paymentId);
        } catch (err) {
          if (!(err instanceof NotFoundError)) {
            this.logger.error(
              `Dodo payments.retrieve(${paymentId}) failed`,
              err instanceof Error ? err.stack : String(err),
            );
            throw new ServiceUnavailableException(
              "Could not reach Dodo Payments",
            );
          }
        }
        return {
          subscriptionId: payment?.subscription_id ?? null,
          payment,
          paymentId,
        };
      }
      default:
        return null;
    }
  }
}
