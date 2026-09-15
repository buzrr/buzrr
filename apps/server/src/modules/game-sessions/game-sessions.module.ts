import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { GameEngineModule } from "../game-engine/game-engine.module";
import { GameSessionsController } from "./game-sessions.controller";
import { GameSessionsService } from "./game-sessions.service";

@Module({
  imports: [GameEngineModule, BillingModule],
  controllers: [GameSessionsController],
  providers: [GameSessionsService],
})
export class GameSessionsModule {}
