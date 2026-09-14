import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import DodoPayments, {
  BadRequestError,
  NotFoundError,
  UnprocessableEntityError,
} from "dodopayments";
import type { CheckoutSessionPreviewResponse } from "dodopayments/resources/checkout-sessions";
import type { Discount } from "dodopayments/resources/discounts";
import { BillingConfig } from "./billing.config";
import { DODO_CLIENT } from "./dodo.provider";

/** India is quoted in INR; everywhere else in USD. */
export type PriceRegion = "IN" | "GLOBAL";

/**
 * The billing country each region is quoted for. GLOBAL quotes a US address so
 * the product's USD base price is used (other countries may be converted by
 * Dodo's Adaptive Currency at checkout if it's enabled on the account).
 */
const QUOTE_COUNTRY = { IN: "IN", GLOBAL: "US" } as const;

/**
 * Shown when billing is off or Dodo can't be reached. Live prices come from
 * Dodo's checkout preview, so a dashboard change reaches the pricing page
 * without a deploy.
 */
export const FALLBACK_PRO_PRICE: Record<
  PriceRegion,
  { currency: string; amount: number }
> = {
  IN: { currency: "INR", amount: 39900 },
  GLOBAL: { currency: "USD", amount: 499 },
};

const CACHE_TTL_MS = 5 * 60 * 1000;
/** Failed lookups are retried sooner, so a Dodo blip doesn't pin the fallback. */
const ERROR_CACHE_TTL_MS = 30 * 1000;

export type DiscountSummary = {
  /** `product` = a discount set on the Dodo product itself; `code` = a discount code. */
  source: "product" | "code";
  code: string | null;
  name: string | null;
  /** Whole percent off the list price, derived from Dodo's quote. */
  percentOff: number;
  /** Minor units off the list price. */
  amountOff: number;
  /** Billing cycles a code applies to; `null` = every cycle (or unknown). */
  subscriptionCycles: number | null;
  expiresAt: string | null;
  /** What Dodo will charge for the first cycle, in minor units. */
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
  /** Any reduction Dodo applies — product discount and/or running promotion. */
  discount: DiscountSummary | null;
};

type QuoteLine = Pick<
  CheckoutSessionPreviewResponse.ProductCart,
  "currency" | "og_price" | "discounted_price" | "tax_inclusive"
>;

/** Why a code can't be used for Buzrr Pro right now, or `null` if it can. */
export function discountRejection(
  discount: Pick<
    Discount,
    "starts_at" | "expires_at" | "usage_limit" | "times_used" | "restricted_to"
  >,
  productId: string,
  now: Date = new Date(),
): string | null {
  if (discount.starts_at && new Date(discount.starts_at) > now) {
    return "This discount code isn't active yet.";
  }
  if (discount.expires_at && new Date(discount.expires_at) <= now) {
    return "This discount code has expired.";
  }
  if (
    discount.usage_limit !== null &&
    discount.usage_limit !== undefined &&
    discount.times_used >= discount.usage_limit
  ) {
    return "This discount code has been fully redeemed.";
  }
  if (
    discount.restricted_to.length > 0 &&
    !discount.restricted_to.includes(productId)
  ) {
    return "This discount code doesn't apply to Buzrr Pro.";
  }
  return null;
}

/**
 * Turn a Dodo preview line into display pricing. No discount math happens here:
 * the list and discounted prices are Dodo's own numbers, so the page always
 * matches what checkout charges.
 */
export function quoteFromPreview(
  line: QuoteLine,
  code: Pick<
    Discount,
    "code" | "name" | "subscription_cycles" | "expires_at"
  > | null,
): Pick<ProPricing, "currency" | "amount" | "taxInclusive" | "discount"> {
  const list = line.og_price;
  const charged = line.discounted_price;
  const off = Math.max(0, list - charged);
  return {
    currency: line.currency,
    amount: list,
    taxInclusive: line.tax_inclusive,
    discount:
      off > 0 && list > 0
        ? {
            source: code ? "code" : "product",
            code: code?.code ?? null,
            name: code?.name ?? null,
            percentOff: Math.round((off / list) * 100),
            amountOff: off,
            subscriptionCycles: code?.subscription_cycles ?? null,
            expiresAt: code?.expires_at ?? null,
            discountedAmount: charged,
          }
        : null,
  };
}

function isRefusal(err: unknown): boolean {
  return (
    err instanceof BadRequestError ||
    err instanceof UnprocessableEntityError ||
    err instanceof NotFoundError
  );
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);
  private readonly cache = new Map<
    string,
    { expires: number; value: unknown }
  >();

  constructor(
    @Inject(DODO_CLIENT) private readonly dodo: DodoPayments,
    private readonly billing: BillingConfig,
  ) {}

  async getProPricing(region: PriceRegion): Promise<ProPricing> {
    if (!this.billing.enabled) {
      return this.fallback(region, false);
    }
    return this.cached(`pricing:${region}`, () => this.loadPricing(region));
  }

  /** Check a code a customer typed. Throws 400 with a readable reason. */
  async validateCode(
    code: string,
    region: PriceRegion,
  ): Promise<DiscountSummary> {
    this.billing.requireEnabled();
    let discount: Discount;
    try {
      discount = await this.dodo.discounts.retrieveByCode(code);
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw invalidCode("That discount code isn't valid.");
      }
      this.logger.error(
        "Dodo discounts.retrieveByCode failed",
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException(
        "Couldn't check that code right now. Please try again in a moment.",
      );
    }
    const rejection = discountRejection(discount, this.billing.proProductId);
    if (rejection) throw invalidCode(rejection);

    let line: QuoteLine;
    try {
      line = await this.previewLine(region, [code]);
    } catch (err) {
      if (isRefusal(err)) {
        throw invalidCode("This discount code can't be applied to Buzrr Pro.");
      }
      this.logger.error(
        "Dodo checkout preview failed while validating a code",
        err instanceof Error ? err.stack : String(err),
      );
      throw new BadGatewayException(
        "Couldn't check that code right now. Please try again in a moment.",
      );
    }
    const quote = quoteFromPreview(line, discount);
    if (!quote.discount) {
      throw invalidCode(
        "This discount code doesn't lower the Buzrr Pro price.",
      );
    }
    return quote.discount;
  }

  /**
   * Codes to put on a checkout session: the customer's own code (validated
   * here, so a bad code fails before checkout is created) or else the running
   * promotion. A discount set on the product itself needs no code — Dodo
   * applies it automatically. `fromPromo` lets checkout retry without the
   * promotion if Dodo refuses it for this customer (e.g. first-time only).
   */
  async checkoutDiscount(
    customerCode: string | undefined,
  ): Promise<{ codes: string[]; fromPromo: boolean } | null> {
    if (customerCode) {
      await this.validateCode(customerCode, "GLOBAL");
      return { codes: [customerCode], fromPromo: false };
    }
    const promo = await this.cached("promo", () => this.loadPromo());
    return promo ? { codes: [promo.code], fromPromo: true } : null;
  }

  private fallback(region: PriceRegion, billingEnabled: boolean): ProPricing {
    return {
      billingEnabled,
      region,
      ...FALLBACK_PRO_PRICE[region],
      taxInclusive: false,
      interval: "month",
      discount: null,
    };
  }

  private async cached<T>(
    key: string,
    load: () => Promise<{ value: T; ok: boolean }>,
  ): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    const { value, ok } = await load();
    this.cache.set(key, {
      value,
      expires: Date.now() + (ok ? CACHE_TTL_MS : ERROR_CACHE_TTL_MS),
    });
    return value;
  }

  private async previewLine(
    region: PriceRegion,
    discountCodes?: string[],
  ): Promise<QuoteLine> {
    const productId = this.billing.proProductId;
    const preview = await this.dodo.checkoutSessions.preview({
      product_cart: [{ product_id: productId, quantity: 1 }],
      billing_address: { country: QUOTE_COUNTRY[region] },
      ...(discountCodes ? { discount_codes: discountCodes } : {}),
    });
    const line =
      preview.product_cart.find((item) => item.product_id === productId) ??
      preview.product_cart[0];
    if (!line) {
      throw new Error(`Dodo preview for ${productId} returned an empty cart`);
    }
    return line;
  }

  /**
   * Quote Pro through Dodo's checkout preview for the region's billing country:
   * localized price, any product-level discount and the running promotion are
   * all resolved by Dodo exactly as checkout will.
   */
  private async loadPricing(
    region: PriceRegion,
  ): Promise<{ value: ProPricing; ok: boolean }> {
    const promo = await this.cached("promo", () => this.loadPromo());
    try {
      let line: QuoteLine;
      let appliedPromo = promo;
      try {
        line = await this.previewLine(region, promo ? [promo.code] : undefined);
      } catch (err) {
        if (!promo || !isRefusal(err)) throw err;
        this.logger.warn(
          `Promo ${promo.code} refused in the ${region} preview; quoting without it`,
        );
        appliedPromo = null;
        line = await this.previewLine(region);
      }
      return {
        value: {
          billingEnabled: true,
          region,
          interval: "month",
          ...quoteFromPreview(line, appliedPromo),
        },
        ok: true,
      };
    } catch (err) {
      this.logger.error(
        `Could not quote Pro pricing from Dodo (${region})`,
        err instanceof Error ? err.stack : String(err),
      );
      return { value: this.fallback(region, true), ok: false };
    }
  }

  /**
   * The promotion named by `DODO_PROMO_DISCOUNT_CODE`, re-read from Dodo so its
   * terms, expiry and redemption count are always current. Codes limited to
   * specific or existing customers aren't advertised to everyone.
   */
  private async loadPromo(): Promise<{ value: Discount | null; ok: boolean }> {
    const code = this.billing.promoCode;
    if (!code) return { value: null, ok: true };
    try {
      const discount = await this.dodo.discounts.retrieveByCode(code);
      const rejection = discountRejection(discount, this.billing.proProductId);
      if (rejection) {
        this.logger.warn(`Promo ${code} not shown: ${rejection}`);
        return { value: null, ok: true };
      }
      if (
        discount.customer_eligibility === "specific" ||
        discount.customer_eligibility === "existing"
      ) {
        this.logger.warn(
          `Promo ${code} not shown: limited to ${discount.customer_eligibility} customers`,
        );
        return { value: null, ok: true };
      }
      return { value: discount, ok: true };
    } catch (err) {
      if (err instanceof NotFoundError) {
        this.logger.warn(`Promo code ${code} does not exist in Dodo`);
        return { value: null, ok: true };
      }
      this.logger.error(
        `Could not load promo ${code} from Dodo`,
        err instanceof Error ? err.stack : String(err),
      );
      return { value: null, ok: false };
    }
  }
}

function invalidCode(message: string): BadRequestException {
  return new BadRequestException({ message, code: "INVALID_DISCOUNT" });
}
