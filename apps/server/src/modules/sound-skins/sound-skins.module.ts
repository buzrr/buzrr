import { BillingModule } from "../billing/billing.module";
import { Module } from "@nestjs/common";
import { SoundSkinsController } from "./sound-skins.controller";
import { SoundSkinsService } from "./sound-skins.service";

@Module({
  imports: [BillingModule],
  controllers: [SoundSkinsController],
  providers: [SoundSkinsService],
})
export class SoundSkinsModule {}
