import { BillingModule } from "../billing/billing.module";
import { Module } from "@nestjs/common";
import { PreferencesService } from "./preferences.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [BillingModule],
  controllers: [UsersController],
  providers: [PreferencesService],
})
export class UsersModule {}
