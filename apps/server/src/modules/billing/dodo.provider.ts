import type { Provider } from "@nestjs/common";
import DodoPayments from "dodopayments";
import { BillingConfig } from "./billing.config";

export const DODO_CLIENT = Symbol("DODO_CLIENT");

export const dodoClientProvider: Provider = {
  provide: DODO_CLIENT,
  inject: [BillingConfig],
  useFactory: (config: BillingConfig) =>
    new DodoPayments({
      // Never called while billing is off — every billing route checks
      // `requireEnabled()` first. The placeholder only keeps the constructor
      // from throwing on instances that don't use Dodo at all.
      bearerToken: config.apiKey || "billing-disabled",
      environment: config.environment,
      webhookKey: config.webhookKey || null,
    }),
};
