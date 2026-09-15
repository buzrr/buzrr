import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import DodoPayments, {
  BadRequestError,
  UnprocessableEntityError,
} from "dodopayments";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { BillingConfig } from "./billing.config";
import { DODO_CLIENT } from "./dodo.provider";
import { EntitlementsService, isProSubscription } from "./entitlements.service";
import type { Entitlements } from "./entitlements.service";
import { PricingService } from "./pricing.service";
import { SubscriptionSyncService } from "./subscription-sync.service";

/** How far back the no-customer-yet sync looks for a just-created subscription. */
const RECENT_CHECKOUT_WINDOW_MS = 2 * 60 * 60 * 1000;
/** Upper bound on subscriptions inspected per sync — it's a fallback, not a crawler. */
const MAX_SYNC_SCAN = 100;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(DODO_CLIENT) private readonly dodo: DodoPayments,
    private readonly prisma: PrismaService,
    private readonly billing: BillingConfig,
    private readonly entitlements: EntitlementsService,
    private readonly sync: SubscriptionSyncService,
    private readonly pricing: PricingService,
  ) {}

  /**
   * Start a hosted Dodo checkout for Buzrr Pro. The account id travels in
   * `metadata`, set here and never taken from the client — that's what the
   * webhook later uses to grant Pro to the right user.
   */
  async createCheckout(
    user: AuthUser,
    discountCode?: string,
  ): Promise<{ checkoutUrl: string }> {
    this.billing.requireEnabled();
    const account = await this.prisma.db.user.findUnique({
      where: { id: user.userId },
      select: { email: true, name: true, dodoCustomerId: true },
    });
    if (!account) {
      throw new NotFoundException("User not found");
    }

    const now = new Date();
    const subs = await this.prisma.db.subscription.findMany({
      where: {
        userId: user.userId,
        status: {
          in: ["active", "on_hold", "past_due", "paused", "cancelled"],
        },
      },
      select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    });
    // A second checkout would double-bill. A subscription in payment trouble is
    // fixed in the portal, not by buying again.
    const live = subs.some(
      (sub) => sub.status !== "cancelled" || isProSubscription(sub, now),
    );
    if (live) {
      throw new ConflictException({
        message:
          "You already have a Buzrr Pro subscription. Manage it from your billing page.",
        code: "ALREADY_SUBSCRIBED",
      });
    }

    // A customer-typed code is validated here (400 before Dodo is called);
    // otherwise the running promotion, if any, is applied automatically.
    const discount = await this.pricing.checkoutDiscount(discountCode);

    const create = (discountCodes: string[] | undefined) =>
      this.dodo.checkoutSessions.create({
        product_cart: [{ product_id: this.billing.proProductId, quantity: 1 }],
        customer: account.dodoCustomerId
          ? { customer_id: account.dodoCustomerId }
          : { email: account.email, name: account.name ?? account.email },
        metadata: { userId: user.userId },
        return_url: `${this.billing.appUrl}/billing/success`,
        cancel_url: `${this.billing.appUrl}/pricing`,
        ...(discountCodes ? { discount_codes: discountCodes } : {}),
        // Customers can still enter a code on Dodo's checkout page.
        feature_flags: { allow_discount_code: true },
      });

    try {
      let session;
      try {
        session = await create(discount?.codes);
      } catch (err) {
        const refused =
          err instanceof BadRequestError ||
          err instanceof UnprocessableEntityError;
        if (!discount || !refused) throw err;
        if (!discount.fromPromo) {
          // Dodo enforces eligibility we can't see (e.g. first-time customers).
          throw new BadRequestException({
            message: "This discount code can't be used on your account.",
            code: "INVALID_DISCOUNT",
          });
        }
        this.logger.warn(
          `Promo ${discount.codes.join(",")} refused for user ${user.userId}; checking out at full price`,
        );
        session = await create(undefined);
      }
      if (!session.checkout_url) {
        throw new Error(`Checkout session ${session.session_id} has no URL`);
      }
      return { checkoutUrl: session.checkout_url };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(
        "Dodo checkout session creation failed",
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException(
        "Could not start checkout. Please try again in a moment.",
      );
    }
  }

  /** Dodo's hosted portal: cancel, update payment method, invoices. */
  async createPortal(user: AuthUser): Promise<{ url: string }> {
    this.billing.requireEnabled();
    const account = await this.prisma.db.user.findUnique({
      where: { id: user.userId },
      select: { dodoCustomerId: true },
    });
    if (!account?.dodoCustomerId) {
      throw new NotFoundException(
        "No billing account yet — subscribe to Buzrr Pro first.",
      );
    }
    try {
      const session = await this.dodo.customers.customerPortal.create(
        account.dodoCustomerId,
        { return_url: `${this.billing.appUrl}/admin/billing` },
      );
      return { url: session.link };
    } catch (err) {
      this.logger.error(
        "Dodo customer portal session creation failed",
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException(
        "Could not open the billing portal. Please try again in a moment.",
      );
    }
  }

  /**
   * Fallback for the checkout success page when the webhook is late: pull this
   * account's Pro subscriptions straight from Dodo and apply them exactly like
   * a webhook would. Takes no client input beyond the authenticated user.
   */
  async syncForUser(user: AuthUser): Promise<Entitlements> {
    this.billing.requireEnabled();
    const account = await this.prisma.db.user.findUnique({
      where: { id: user.userId },
      select: { dodoCustomerId: true },
    });
    if (!account) {
      throw new NotFoundException("User not found");
    }

    const subscriptionIds: string[] = [];
    try {
      // Before the first webhook lands there's no customer link yet, so look at
      // recent Pro subscriptions and keep the ones whose server-set metadata
      // names this account.
      const pages = account.dodoCustomerId
        ? this.dodo.subscriptions.list({
            customer_id: account.dodoCustomerId,
            product_id: this.billing.proProductId,
          })
        : this.dodo.subscriptions.list({
            product_id: this.billing.proProductId,
            created_at_gte: new Date(
              Date.now() - RECENT_CHECKOUT_WINDOW_MS,
            ).toISOString(),
          });
      let scanned = 0;
      for await (const sub of pages) {
        if (++scanned > MAX_SYNC_SCAN) break;
        if (account.dodoCustomerId || sub.metadata?.userId === user.userId) {
          subscriptionIds.push(sub.subscription_id);
        }
      }
    } catch (err) {
      this.logger.error(
        "Dodo subscriptions.list failed during sync",
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException(
        "Could not reach the payment provider. Please try again in a moment.",
      );
    }

    for (const subscriptionId of subscriptionIds) {
      await this.prisma.db.$transaction(
        async (tx) => {
          await this.sync.lock(tx, subscriptionId);
          const subscription = await this.sync.fetch(subscriptionId);
          if (subscription) await this.sync.apply(tx, subscription);
        },
        { maxWait: 5_000, timeout: 20_000 },
      );
    }

    return this.entitlements.getEntitlements(user.userId);
  }
}
