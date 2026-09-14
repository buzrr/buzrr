import { randomUUID } from "node:crypto";
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma } from "@buzrr/prisma";
import DodoPayments from "dodopayments";
import type { Payment as DodoPayment } from "dodopayments/resources/payments";
import type { Subscription as DodoSubscription } from "dodopayments/resources/subscriptions";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { BillingWebhookService } from "../billing-webhook.service";
import { EntitlementsService } from "../entitlements.service";
import { SubscriptionSyncService } from "../subscription-sync.service";
import {
  PRO_PRODUCT_ID,
  WEBHOOK_KEY,
  billingConfig,
  createUser,
  deleteUsers,
  isDatabaseReachable,
  prismaService,
  signedHeaders,
} from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

describe("BillingWebhookService (Postgres, Dodo API mocked)", () => {
  const config = billingConfig();
  const dodo = new DodoPayments({
    bearerToken: "test-api-key",
    environment: "test_mode",
    webhookKey: WEBHOOK_KEY,
  });
  const retrieveSubscription = vi.spyOn(dodo.subscriptions, "retrieve");
  const retrievePayment = vi.spyOn(dodo.payments, "retrieve");
  const service = new BillingWebhookService(
    dodo,
    prismaService,
    config,
    new SubscriptionSyncService(dodo, config),
  );
  const entitlements = new EntitlementsService(prismaService, config);

  const userIds: string[] = [];
  const webhookIds: string[] = [];
  const subscriptionIds: string[] = [];
  let dbUp = false;

  beforeAll(async () => {
    dbUp = await isDatabaseReachable();
  });

  afterEach(() => {
    retrieveSubscription.mockReset();
    retrievePayment.mockReset();
  });

  afterAll(async () => {
    if (!dbUp) return;
    await prisma.billingEvent.deleteMany({
      where: { webhookId: { in: webhookIds } },
    });
    await prisma.subscription.deleteMany({
      where: { dodoSubscriptionId: { in: subscriptionIds } },
    });
    await deleteUsers(userIds);
  });

  async function user() {
    const id = await createUser();
    userIds.push(id);
    return id;
  }

  function dodoSubscription(
    userId: string | null,
    overrides: Partial<DodoSubscription> = {},
  ): DodoSubscription {
    const subscriptionId =
      overrides.subscription_id ?? `sub_test_${randomUUID()}`;
    subscriptionIds.push(subscriptionId);
    return {
      subscription_id: subscriptionId,
      product_id: PRO_PRODUCT_ID,
      status: "active",
      customer: {
        customer_id: `cus_test_${randomUUID()}`,
        email: "payer@example.test",
        name: "Payer",
      },
      metadata: userId ? { userId } : {},
      currency: "USD",
      recurring_pre_tax_amount: 499,
      previous_billing_date: new Date(Date.now() - 10 * DAY).toISOString(),
      next_billing_date: new Date(Date.now() + 20 * DAY).toISOString(),
      cancel_at_next_billing_date: false,
      cancelled_at: null,
      ...overrides,
    } as DodoSubscription;
  }

  /** Dodo's current view of a subscription, as `subscriptions.retrieve` returns it. */
  function dodoHas(sub: DodoSubscription) {
    retrieveSubscription.mockResolvedValue(sub as never);
  }

  async function deliver(type: string, data: unknown, webhookId?: string) {
    const body = JSON.stringify({
      business_id: "bus_test",
      type,
      timestamp: new Date().toISOString(),
      data,
    });
    const headers = signedHeaders(body, webhookId);
    webhookIds.push(headers["webhook-id"]);
    await service.handle(Buffer.from(body), headers);
    return headers["webhook-id"];
  }

  it("rejects a payload with a bad signature", async (ctx) => {
    if (!dbUp) ctx.skip();
    const body = JSON.stringify({ type: "subscription.active", data: {} });
    const headers = signedHeaders(body);
    await expect(
      service.handle(Buffer.from(body.replace("active", "expired")), headers),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(retrieveSubscription).not.toHaveBeenCalled();
  });

  it("grants Pro on subscription.active and records the customer", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const sub = dodoSubscription(userId);
    dodoHas(sub);

    await deliver("subscription.active", sub);

    expect(await entitlements.resolvePlan(userId)).toBe("pro");
    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.dodoCustomerId).toBe(sub.customer.customer_id);
  });

  it("processes a redelivered webhook only once", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const sub = dodoSubscription(userId);
    dodoHas(sub);

    const webhookId = await deliver("subscription.active", sub);
    await deliver("subscription.active", sub, webhookId);

    expect(retrieveSubscription).toHaveBeenCalledTimes(1);
  });

  it("records payment.succeeded and syncs its subscription", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const sub = dodoSubscription(userId);
    dodoHas(sub);
    const paymentId = `pay_test_${randomUUID()}`;

    await deliver("payment.succeeded", {
      payment_id: paymentId,
      subscription_id: sub.subscription_id,
      status: "succeeded",
      total_amount: 499,
      currency: "USD",
      customer: sub.customer,
      metadata: { userId },
    } satisfies Partial<DodoPayment>);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { dodoPaymentId: paymentId },
    });
    expect(payment).toMatchObject({ userId, status: "succeeded", amount: 499 });
    expect(await entitlements.resolvePlan(userId)).toBe("pro");
  });

  it("applies Dodo's current state, so an out-of-order event can't restore Pro", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const sub = dodoSubscription(userId);
    dodoHas(sub);
    await deliver("subscription.active", sub);

    // The subscription was cancelled at Dodo; a stale `renewed` arrives late.
    const cancelled = {
      ...sub,
      status: "cancelled" as const,
      cancelled_at: new Date().toISOString(),
    };
    dodoHas(cancelled);
    await deliver("subscription.renewed", sub);

    expect(await entitlements.resolvePlan(userId)).toBe("free");
  });

  it("drops to Free on a failed renewal and restores Pro on recovery", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const sub = dodoSubscription(userId);

    dodoHas({ ...sub, status: "on_hold" });
    await deliver("subscription.on_hold", sub);
    expect(await entitlements.resolvePlan(userId)).toBe("free");

    dodoHas(sub);
    await deliver("subscription.active", sub);
    expect(await entitlements.resolvePlan(userId)).toBe("pro");
  });

  it("keeps Pro after cancel-at-period-end until expiry", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const sub = dodoSubscription(userId, { cancel_at_next_billing_date: true });

    dodoHas({ ...sub, status: "cancelled" });
    await deliver("subscription.cancelled", sub);
    expect(await entitlements.resolvePlan(userId)).toBe("pro");

    dodoHas({ ...sub, status: "expired" });
    await deliver("subscription.expired", sub);
    expect(await entitlements.resolvePlan(userId)).toBe("free");
  });

  it("ignores subscriptions to other products", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const sub = dodoSubscription(userId, { product_id: "pdt_something_else" });
    dodoHas(sub);

    await deliver("subscription.active", sub);

    expect(await entitlements.resolvePlan(userId)).toBe("free");
    expect(
      await prisma.subscription.count({
        where: { dodoSubscriptionId: sub.subscription_id },
      }),
    ).toBe(0);
  });

  it("falls back to the linked Dodo customer when metadata is missing", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const sub = dodoSubscription(null);
    await prisma.user.update({
      where: { id: userId },
      data: { dodoCustomerId: sub.customer.customer_id },
    });
    dodoHas(sub);

    await deliver("subscription.renewed", sub);

    expect(await entitlements.resolvePlan(userId)).toBe("pro");
  });

  it("returns 503 and commits nothing when Dodo can't be reached", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const sub = dodoSubscription(userId);
    retrieveSubscription.mockRejectedValue(new Error("network down"));

    const body = JSON.stringify({
      business_id: "bus_test",
      type: "subscription.active",
      timestamp: new Date().toISOString(),
      data: sub,
    });
    const headers = signedHeaders(body);
    webhookIds.push(headers["webhook-id"]);

    await expect(
      service.handle(Buffer.from(body), headers),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    // The idempotency claim rolled back, so Dodo's retry will be processed.
    expect(
      await prisma.billingEvent.findUnique({
        where: { webhookId: headers["webhook-id"] },
      }),
    ).toBeNull();
    expect(await entitlements.resolvePlan(userId)).toBe("free");
  });
});
