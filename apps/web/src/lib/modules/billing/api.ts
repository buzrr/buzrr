import type { AxiosInstance } from "axios";
import { getAuthApiClient, getPublicApiClient } from "@/lib/api/client";
import type { PriceRegion } from "@/lib/pricing";

/**
 * Hand-written mirrors of `apps/server/src/modules/billing` response shapes
 * (no codegen in this repo — change these when the server's change).
 */

export type PlanId = "free" | "pro";

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "on_hold"
  | "paused"
  | "past_due"
  | "cancelled"
  | "failed"
  | "expired";

export type PlanLimits = {
  maxPlayers: number;
  /** `null` = unlimited. */
  maxQuizzes: number | null;
  ai: { kind: "lifetime" | "weekly"; amount: number };
};

export type Entitlements = {
  plan: PlanId;
  billingEnabled: boolean;
  limits: PlanLimits;
  usage: {
    quizCount: number;
    aiTokensUsed: number;
    aiTokensRemaining: number;
    aiTokensResetAt: string | null;
  };
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    currency: string;
    recurringAmount: number;
  } | null;
};

export type DiscountSummary = {
  /** `product` = discount set on the Dodo product; `code` = a discount code. */
  source: "product" | "code";
  code: string | null;
  name: string | null;
  /** Whole percent off the list price, from Dodo's quote. */
  percentOff: number;
  /** Minor units off the list price. */
  amountOff: number;
  /** Billing cycles a code applies to; `null` = every cycle. */
  subscriptionCycles: number | null;
  expiresAt: string | null;
  /** What Dodo charges for the first cycle, in minor units. */
  discountedAmount: number;
};

export type ProPricing = {
  billingEnabled: boolean;
  region: PriceRegion;
  currency: string;
  /** List price in minor units (paise / cents). */
  amount: number;
  /** Whether `amount` already includes tax (e.g. GST in India). */
  taxInclusive: boolean;
  interval: "month";
  /** Any reduction Dodo applies: product discount and/or running promotion. */
  discount: DiscountSummary | null;
};

export async function getProPricing(
  client: AxiosInstance,
  region: PriceRegion,
) {
  const { data } = await client.get<ProPricing>("/billing/pricing", {
    params: { region },
  });
  return data;
}

export async function validateDiscount(
  client: AxiosInstance,
  body: { code: string; region: PriceRegion },
) {
  const { data } = await client.post<DiscountSummary>(
    "/billing/discounts/validate",
    body,
  );
  return data;
}

export async function getEntitlements(client: AxiosInstance) {
  const { data } = await client.get<Entitlements>("/billing/me");
  return data;
}

export async function createCheckout(
  client: AxiosInstance,
  body: { discountCode?: string } = {},
) {
  const { data } = await client.post<{ checkoutUrl: string }>(
    "/billing/checkout",
    body,
  );
  return data;
}

export async function createPortal(client: AxiosInstance) {
  const { data } = await client.post<{ url: string }>("/billing/portal");
  return data;
}

export async function syncBilling(client: AxiosInstance) {
  const { data } = await client.post<Entitlements>("/billing/sync");
  return data;
}

export const billingApi = {
  me: () => getEntitlements(getAuthApiClient()),
  pricing: (region: PriceRegion) => getProPricing(getPublicApiClient(), region),
  validateDiscount: (body: Parameters<typeof validateDiscount>[1]) =>
    validateDiscount(getAuthApiClient(), body),
  checkout: (body?: { discountCode?: string }) =>
    createCheckout(getAuthApiClient(), body),
  portal: () => createPortal(getAuthApiClient()),
  sync: () => syncBilling(getAuthApiClient()),
};
