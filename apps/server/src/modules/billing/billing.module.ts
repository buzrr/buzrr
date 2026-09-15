import { Module } from "@nestjs/common";
import { BillingWebhookController } from "./billing-webhook.controller";
import { BillingWebhookService } from "./billing-webhook.service";
import { BillingConfig } from "./billing.config";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { dodoClientProvider } from "./dodo.provider";
import { EntitlementsService } from "./entitlements.service";
import { PricingService } from "./pricing.service";
import { SubscriptionSyncService } from "./subscription-sync.service";

@Module({
  controllers: [BillingController, BillingWebhookController],
  providers: [
    BillingConfig,
    dodoClientProvider,
    EntitlementsService,
    PricingService,
    SubscriptionSyncService,
    BillingService,
    BillingWebhookService,
  ],
  exports: [EntitlementsService, BillingConfig],
})
export class BillingModule {}
