import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * `BILLING=ON` switches Buzrr Pro on. Off (the default — local dev, self-hosted
 * instances of this open-source repo) means there is no Dodo integration and
 * every account resolves to Pro limits, so the app stays usable without a
 * payment provider. Mirrors the `RATELIMIT=ON` switch.
 *
 * When ON, missing Dodo configuration fails at boot rather than on the first
 * checkout or webhook (same stance as `redis.module.ts`).
 */
@Injectable()
export class BillingConfig {
  readonly enabled: boolean;
  readonly apiKey: string;
  readonly webhookKey: string;
  readonly environment: "live_mode" | "test_mode";
  readonly proProductId: string;
  readonly appUrl: string;
  readonly promoCode: string | null;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>("BILLING") === "ON";
    this.apiKey = config.get<string>("DODO_PAYMENTS_API_KEY")?.trim() ?? "";
    this.webhookKey =
      config.get<string>("DODO_PAYMENTS_WEBHOOK_KEY")?.trim() ?? "";
    // Narrowed rather than cast: an unset or misspelled value must never
    // select live mode.
    this.environment =
      config.get<string>("DODO_PAYMENTS_ENVIRONMENT") === "live_mode"
        ? "live_mode"
        : "test_mode";
    this.proProductId = config.get<string>("DODO_PRO_PRODUCT_ID")?.trim() ?? "";
    this.appUrl = (config.get<string>("APP_URL")?.trim() ?? "").replace(
      /\/$/,
      "",
    );
    // Optional. A Dodo discount code advertised on the pricing page and applied
    // to checkouts automatically; its terms are always read live from Dodo.
    this.promoCode =
      config.get<string>("DODO_PROMO_DISCOUNT_CODE")?.trim() || null;

    if (this.enabled) {
      const missing = [
        ["DODO_PAYMENTS_API_KEY", this.apiKey],
        ["DODO_PAYMENTS_WEBHOOK_KEY", this.webhookKey],
        ["DODO_PRO_PRODUCT_ID", this.proProductId],
        ["APP_URL", this.appUrl],
      ]
        .filter(([, value]) => !value)
        .map(([key]) => key);
      if (missing.length > 0) {
        throw new Error(
          `BILLING=ON but ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not set`,
        );
      }
    }
  }

  requireEnabled(): void {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        "Billing is not enabled on this Buzrr instance.",
      );
    }
  }
}
