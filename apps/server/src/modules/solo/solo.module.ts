import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { SoloPlayController, SoloTestsController } from "./solo.controller";
import { SoloService } from "./solo.service";

@Module({
  imports: [BillingModule],
  controllers: [SoloTestsController, SoloPlayController],
  providers: [SoloService],
})
export class SoloModule {}
