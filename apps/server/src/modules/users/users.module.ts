import { Module } from "@nestjs/common";
import { PreferencesService } from "./preferences.service";
import { UsersController } from "./users.controller";

@Module({
  controllers: [UsersController],
  providers: [PreferencesService],
})
export class UsersModule {}
