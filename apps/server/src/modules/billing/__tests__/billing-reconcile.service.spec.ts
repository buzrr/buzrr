import { prisma } from "@buzrr/prisma";
import type Redis from "ioredis";
import DodoPayments, { NotFoundError } from "dodopayments";
import type { Subscription as DodoSubscription } from "dodopayments/resources/subscriptions";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { BillingReconcileService } from "../billing-reconcile.service";
import { EntitlementsService } from "../entitlements.service";
import { SubscriptionSyncService } from "../subscription-sync.service";
import {
  PRO_PRODUCT_ID,
  WEBHOOK_KEY,
  billingConfig,
  createSubscription,
  createUser,
  deleteUsers,
  prismaService,
  requireDatabase,
} from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

describe("BillingReconcileService (Postgres, Dodo API + Redis mocked)", () => {
  const config = billingConfig();
  const dodo = new DodoPayments({
    bearerToken: "test-api-key",
    environment: "test_mode",
    webhookKey: WEBHOOK_KEY,
  });
  const retrieveSubscription = vi.spyOn(dodo.subscriptions, "retrieve");
  const sync = new SubscriptionSyncService(dodo, config, prismaService);
  const entitlements = new EntitlementsService(prismaService, config);

  /** Dodo's current view, by subscription id; anything else is a 404. */
  const dodoState = new Map<string, DodoSubscription>();
  let lockHeld = false;
  const redis = {
    set: vi.fn(async () => (lockHeld ? null : "OK")),
  } as unknown as Redis;
  const service = new BillingReconcileService(
    prismaService,
    config,
    sync,
    redis,
  );

  const userIds: string[] = [];
  let dbUp = false;

  beforeAll(async () => {
    dbUp = await requireDatabase();
  });

  beforeEach(() => {
    lockHeld = false;
    retrieveSubscription.mockImplementation(((id: string) => {
      const sub = dodoState.get(id);
      return sub
        ? Promise.resolve(sub)
        : Promise.reject(
            new NotFoundError(404, {}, "not found", new Headers()),
          );
    }) as never);
  });

  afterEach(() => {
    retrieveSubscription.mockReset();
    dodoState.clear();
  });

  afterAll(async () => {
    if (dbUp) await deleteUsers(userIds);
  });

  async function user() {
    const id = await createUser();
    userIds.push(id);
    return id;
  }

  function dodoReports(
    row: { dodoSubscriptionId: string; dodoCustomerId: string },
    userId: string,
    overrides: Partial<DodoSubscription>,
  ) {
    dodoState.set(row.dodoSubscriptionId, {
      subscription_id: row.dodoSubscriptionId,
      product_id: PRO_PRODUCT_ID,
      status: "active",
      customer: {
        customer_id: row.dodoCustomerId,
        email: "payer@example.test",
        name: "Payer",
      },
      metadata: { userId },
      currency: "USD",
      recurring_pre_tax_amount: 499,
      previous_billing_date: new Date(Date.now() - 33 * DAY).toISOString(),
      next_billing_date: new Date(Date.now() - 3 * DAY).toISOString(),
      cancel_at_next_billing_date: false,
      cancelled_at: null,
      ...overrides,
    } as DodoSubscription);
  }

  it("drops an overdue subscription to Free when Dodo reports the renewal failed", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const row = await createSubscription(userId, {
      currentPeriodEnd: new Date(Date.now() - 3 * DAY),
    });
    dodoReports(row, userId, { status: "on_hold" });

    const result = await service.reconcile();

    expect(result.skipped).toBe(false);
    expect(retrieveSubscription).toHaveBeenCalledWith(row.dodoSubscriptionId);
    const after = await prisma.subscription.findUnique({
      where: { id: row.id },
    });
    expect(after?.status).toBe("on_hold");
    expect(await entitlements.resolvePlan(userId)).toBe("free");
  });

  it("keeps Pro when Dodo confirms the renewal a webhook missed", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const row = await createSubscription(userId, {
      currentPeriodEnd: new Date(Date.now() - 3 * DAY),
    });
    // Over the grace already, so Free until Dodo's state is mirrored.
    expect(await entitlements.resolvePlan(userId)).toBe("free");
    const nextBilling = new Date(Date.now() + 27 * DAY);
    dodoReports(row, userId, {
      status: "active",
      next_billing_date: nextBilling.toISOString(),
    });

    await service.reconcile();

    const after = await prisma.subscription.findUnique({
      where: { id: row.id },
    });
    expect(after?.currentPeriodEnd?.getTime()).toBe(nextBilling.getTime());
    expect(await entitlements.resolvePlan(userId)).toBe("pro");
  });

  it("leaves a subscription that isn't due yet alone", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    const row = await createSubscription(userId);

    await service.reconcile();

    expect(retrieveSubscription).not.toHaveBeenCalledWith(
      row.dodoSubscriptionId,
    );
  });

  it("skips the pass while another instance holds the lock", async (ctx) => {
    if (!dbUp) ctx.skip();
    const userId = await user();
    await createSubscription(userId, {
      currentPeriodEnd: new Date(Date.now() - 3 * DAY),
    });
    lockHeld = true;

    expect(await service.reconcile()).toEqual({ skipped: true });
    expect(retrieveSubscription).not.toHaveBeenCalled();
  });

  it("does nothing when billing is off", async () => {
    const selfHosted = new BillingReconcileService(
      prismaService,
      billingConfig({ BILLING: "OFF" }),
      sync,
      redis,
    );
    vi.mocked(redis.set).mockClear();

    expect(await selfHosted.reconcile()).toEqual({ skipped: true });
    expect(redis.set).not.toHaveBeenCalled();
  });
});
