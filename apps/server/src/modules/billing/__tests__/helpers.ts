import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import { prisma } from "@buzrr/prisma";
import type { SubscriptionStatus } from "@buzrr/prisma";
import type { PrismaService } from "../../../prisma/prisma.service";
import { BillingConfig } from "../billing.config";

export const PRO_PRODUCT_ID = "pdt_buzrr_pro_test";

const WEBHOOK_SECRET = randomBytes(24);
export const WEBHOOK_KEY = `whsec_${WEBHOOK_SECRET.toString("base64")}`;

export const prismaService = { db: prisma } as unknown as PrismaService;

export function billingConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    BILLING: "ON",
    DODO_PAYMENTS_API_KEY: "test-api-key",
    DODO_PAYMENTS_WEBHOOK_KEY: WEBHOOK_KEY,
    DODO_PRO_PRODUCT_ID: PRO_PRODUCT_ID,
    APP_URL: "http://localhost:3000",
    ...overrides,
  };
  return new BillingConfig({
    get: (key: string) => values[key],
  } as unknown as ConfigService);
}

/** Standard Webhooks signature over `id.timestamp.body`, as Dodo sends it. */
export function signedHeaders(
  body: string,
  id = `wh_test_${randomUUID()}`,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return {
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": `v1,${signature}`,
  };
}

export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function createUser(): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `billing-test-${randomUUID()}@example.test`,
      name: "Billing Test",
    },
    select: { id: true },
  });
  return user.id;
}

export async function createSubscription(
  userId: string,
  fields: {
    status?: SubscriptionStatus;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  } = {},
) {
  return prisma.subscription.create({
    data: {
      userId,
      dodoSubscriptionId: `sub_test_${randomUUID()}`,
      dodoCustomerId: `cus_test_${randomUUID()}`,
      productId: PRO_PRODUCT_ID,
      status: fields.status ?? "active",
      currency: "USD",
      recurringAmount: 499,
      currentPeriodEnd:
        fields.currentPeriodEnd === undefined
          ? new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
          : fields.currentPeriodEnd,
      cancelAtPeriodEnd: fields.cancelAtPeriodEnd ?? false,
    },
  });
}

/** Subscriptions and payments outlive users (SET NULL), so remove them first. */
export async function deleteUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
