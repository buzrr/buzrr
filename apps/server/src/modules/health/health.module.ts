import { Module } from "@nestjs/common";
import { GameEngineModule } from "../game-engine/game-engine.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [GameEngineModule],
  controllers: [HealthController],
})
export class HealthModule {}
